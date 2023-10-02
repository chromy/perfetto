/*
 * Copyright (C) 2019 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "src/trace_processor/importers/proto/heap_graph_tracker.h"

#include <optional>

#include "perfetto/base/flat_set.h"
#include "perfetto/ext/base/string_splitter.h"
#include "perfetto/ext/base/string_utils.h"
#include "src/trace_processor/importers/proto/profiler_util.h"
#include "src/trace_processor/tables/profiler_tables_py.h"

namespace perfetto {
namespace trace_processor {

namespace {

using ClassTable = tables::HeapGraphClassTable;
using ObjectTable = tables::HeapGraphObjectTable;
using ReferenceTable = tables::HeapGraphReferenceTable;

// Iterates all the references owned by the object `id`.
//
// Calls bool(*fn)(ObjectTable::RowReference) with the each row
// from the `storage.heap_graph_reference()` table associated to the |object|.
// When `fn` returns false (or when there are no more rows owned by |object|),
// stops the iteration.
template <typename F>
void ForReferenceSet(TraceStorage* storage,
                     ObjectTable::ConstRowReference object,
                     F fn) {
  std::optional<uint32_t> reference_set_id = object.reference_set_id();
  if (!reference_set_id)
    return;

  auto* ref = storage->mutable_heap_graph_reference_table();
  auto it =
      ref->FilterToIterator({ref->reference_set_id().eq(*reference_set_id)});

  for (; it; ++it) {
    if (!fn(it.row_reference()))
      break;
  }
}

base::FlatSet<ObjectTable::Id> GetChildren(TraceStorage* storage,
                                           ObjectTable::RowReference object) {
  auto cls_row_ref =
      *storage->heap_graph_class_table().FindById(object.type_id());

  StringId kind = cls_row_ref.kind();
  std::optional<StringId> weakref_kind =
      storage->string_pool().GetId("KIND_WEAK_REFERENCE");
  std::optional<StringId> softref_kind =
      storage->string_pool().GetId("KIND_SOFT_REFERENCE");
  std::optional<StringId> finalizerref_kind =
      storage->string_pool().GetId("KIND_FINALIZER_REFERENCE");
  std::optional<StringId> phantomref_kind =
      storage->string_pool().GetId("KIND_PHANTOM_REFERENCE");

  if ((weakref_kind && kind == *weakref_kind) ||
      (softref_kind && kind == *softref_kind) ||
      (finalizerref_kind && kind == *finalizerref_kind) ||
      (phantomref_kind && kind == *phantomref_kind)) {
    // Do not follow weak / soft / finalizer / phantom references.
    return {};
  }

  base::FlatSet<ObjectTable::Id> children;
  ForReferenceSet(storage, object,
                  [object, &children](ReferenceTable::RowReference ref) {
                    PERFETTO_CHECK(ref.owner_id() == object.id());
                    auto opt_owned = ref.owned_id();
                    if (opt_owned) {
                      children.insert(*opt_owned);
                    }
                    return true;
                  });
  return children;
}

struct ClassDescriptor {
  StringId name;
  std::optional<StringId> location;

  bool operator<(const ClassDescriptor& other) const {
    return std::tie(name, location) < std::tie(other.name, other.location);
  }
};

ClassDescriptor GetClassDescriptor(const TraceStorage& storage,
                                   ObjectTable::Id obj_id) {
  auto obj_row_ref = *storage.heap_graph_object_table().FindById(obj_id);
  auto type_row_ref =
      *storage.heap_graph_class_table().FindById(obj_row_ref.type_id());
  return {type_row_ref.name(), type_row_ref.location()};
}

std::optional<ObjectTable::Id> GetReferredObj(const TraceStorage& storage,
                                              uint32_t ref_set_id,
                                              const std::string& field_name) {
  const auto& refs_tbl = storage.heap_graph_reference_table();

  auto refs_it = refs_tbl.FilterToIterator(
      {refs_tbl.reference_set_id().eq(ref_set_id),
       refs_tbl.field_name().eq(NullTermStringView(field_name))});
  if (!refs_it) {
    return std::nullopt;
  }
  return refs_it.owned_id();
}

// Maps from normalized class name and location, to superclass.
std::map<ClassDescriptor, ClassDescriptor>
BuildSuperclassMap(UniquePid upid, int64_t ts, TraceStorage* storage) {
  std::map<ClassDescriptor, ClassDescriptor> superclass_map;

  // Resolve superclasses by iterating heap graph objects and identifying the
  // superClass field.
  const auto& objects_tbl = storage->heap_graph_object_table();
  auto obj_it = objects_tbl.FilterToIterator(
      {objects_tbl.upid().eq(upid), objects_tbl.graph_sample_ts().eq(ts)});
  for (; obj_it; ++obj_it) {
    auto obj_id = obj_it.id();
    auto class_descriptor = GetClassDescriptor(*storage, obj_id);
    auto normalized =
        GetNormalizedType(storage->GetString(class_descriptor.name));
    // superClass ptrs are stored on the static class objects
    // ignore arrays (as they are generated objects)
    if (!normalized.is_static_class || normalized.number_of_arrays > 0)
      continue;

    auto opt_ref_set_id = obj_it.reference_set_id();
    if (!opt_ref_set_id)
      continue;
    auto super_obj_id =
        GetReferredObj(*storage, *opt_ref_set_id, "java.lang.Class.superClass");
    if (!super_obj_id) {
      // This is expected to be missing for Object and primitive types
      continue;
    }

    // Lookup the super obj type id
    auto super_class_descriptor = GetClassDescriptor(*storage, *super_obj_id);
    auto super_class_name =
        NormalizeTypeName(storage->GetString(super_class_descriptor.name));
    StringId super_class_id = storage->InternString(super_class_name);
    StringId class_id = storage->InternString(normalized.name);
    superclass_map[{class_id, class_descriptor.location}] = {
        super_class_id, super_class_descriptor.location};
  }
  return superclass_map;
}

// Extract the size from `nar_size`, which is the value of a
// libcore.util.NativeAllocationRegistry.size field: it encodes the size, but
// uses the least significant bit to represent the source of the allocation.
int64_t GetSizeFromNativeAllocationRegistry(int64_t nar_size) {
  constexpr uint64_t kIsMalloced = 1;
  return static_cast<int64_t>(static_cast<uint64_t>(nar_size) & ~kIsMalloced);
}

}  // namespace

void MarkRoot(TraceStorage* storage,
              ObjectTable::RowReference row_ref,
              StringId type) {
  row_ref.set_root_type(type);

  // DFS to mark reachability for all children
  std::vector<ObjectTable::RowReference> stack({row_ref});
  while (!stack.empty()) {
    ObjectTable::RowReference cur_node = stack.back();
    stack.pop_back();

    if (cur_node.reachable())
      continue;
    cur_node.set_reachable(true);

    for (ObjectTable::Id child_node : GetChildren(storage, cur_node)) {
      auto child_ref =
          *storage->mutable_heap_graph_object_table()->FindById(child_node);
      stack.push_back(child_ref);
    }
  }
}

void UpdateShortestPaths(TraceStorage* storage,
                         ObjectTable::RowReference row_ref) {
  // Calculate shortest distance to a GC root.
  std::deque<std::pair<int32_t, ObjectTable::RowReference>> reachable_nodes{
      {0, row_ref}};
  while (!reachable_nodes.empty()) {
    auto pair = reachable_nodes.front();

    int32_t distance = pair.first;
    ObjectTable::RowReference cur_row_ref = pair.second;

    reachable_nodes.pop_front();
    int32_t cur_distance = cur_row_ref.root_distance();
    if (cur_distance == -1 || cur_distance > distance) {
      cur_row_ref.set_root_distance(distance);

      for (ObjectTable::Id child_node : GetChildren(storage, cur_row_ref)) {
        auto child_row_ref =
            *storage->mutable_heap_graph_object_table()->FindById(child_node);
        int32_t child_distance = child_row_ref.root_distance();
        if (child_distance == -1 || child_distance > distance + 1)
          reachable_nodes.emplace_back(distance + 1, child_row_ref);
      }
    }
  }
}

std::optional<base::StringView> GetStaticClassTypeName(base::StringView type) {
  static const base::StringView kJavaClassTemplate("java.lang.Class<");
  if (!type.empty() && type.at(type.size() - 1) == '>' &&
      type.substr(0, kJavaClassTemplate.size()) == kJavaClassTemplate) {
    return type.substr(kJavaClassTemplate.size(),
                       type.size() - kJavaClassTemplate.size() - 1);
  }
  return {};
}

size_t NumberOfArrays(base::StringView type) {
  if (type.size() < 2)
    return 0;

  size_t arrays = 0;
  while (type.size() >= 2 * (arrays + 1) &&
         memcmp(type.end() - 2 * (arrays + 1), "[]", 2) == 0) {
    arrays++;
  }
  return arrays;
}

NormalizedType GetNormalizedType(base::StringView type) {
  auto static_class_type_name = GetStaticClassTypeName(type);
  if (static_class_type_name.has_value()) {
    type = static_class_type_name.value();
  }
  size_t number_of_arrays = NumberOfArrays(type);
  return {base::StringView(type.data(), type.size() - number_of_arrays * 2),
          static_class_type_name.has_value(), number_of_arrays};
}

base::StringView NormalizeTypeName(base::StringView type) {
  return GetNormalizedType(type).name;
}

std::string DenormalizeTypeName(NormalizedType normalized,
                                base::StringView deobfuscated_type_name) {
  std::string result = deobfuscated_type_name.ToStdString();
  for (size_t i = 0; i < normalized.number_of_arrays; ++i) {
    result += "[]";
  }
  if (normalized.is_static_class) {
    result = "java.lang.Class<" + result + ">";
  }
  return result;
}

HeapGraphTracker::HeapGraphTracker(TraceStorage* storage)
    : storage_(storage),
      cleaner_thunk_str_id_(storage_->InternString("sun.misc.Cleaner.thunk")),
      referent_str_id_(
          storage_->InternString("java.lang.ref.Reference.referent")),
      cleaner_thunk_this0_str_id_(storage_->InternString(
          "libcore.util.NativeAllocationRegistry$CleanerThunk.this$0")),
      native_size_str_id_(
          storage_->InternString("libcore.util.NativeAllocationRegistry.size")),
      cleaner_next_str_id_(storage_->InternString("sun.misc.Cleaner.next")) {
  for (size_t i = 0; i < root_type_string_ids_.size(); i++) {
    auto val = static_cast<protos::pbzero::HeapGraphRoot::Type>(i);
    auto str_view =
        base::StringView(protos::pbzero::HeapGraphRoot_Type_Name(val));
    root_type_string_ids_[i] = storage_->InternString(str_view);
  }
}

HeapGraphTracker::SequenceState& HeapGraphTracker::GetOrCreateSequence(
    uint32_t seq_id) {
  return sequence_state_[seq_id];
}

bool HeapGraphTracker::SetPidAndTimestamp(SequenceState* sequence_state,
                                          UniquePid upid,
                                          int64_t ts) {
  if (sequence_state->current_upid != 0 &&
      sequence_state->current_upid != upid) {
    storage_->IncrementStats(stats::heap_graph_non_finalized_graph);
    return false;
  }
  if (sequence_state->current_ts != 0 && sequence_state->current_ts != ts) {
    storage_->IncrementStats(stats::heap_graph_non_finalized_graph);
    return false;
  }
  sequence_state->current_upid = upid;
  sequence_state->current_ts = ts;
  return true;
}

ObjectTable::RowReference HeapGraphTracker::GetOrInsertObject(
    SequenceState* sequence_state,
    uint64_t object_id) {
  auto object_table = storage_->mutable_heap_graph_object_table();
  auto* ptr = sequence_state->object_id_to_db_row.Find(object_id);
  if (!ptr) {
    auto id_and_row = object_table->Insert({sequence_state->current_upid,
                                            sequence_state->current_ts,
                                            -1,
                                            0,
                                            /*reference_set_id=*/std::nullopt,
                                            /*reachable=*/0,
                                            {},
                                            /*root_type=*/std::nullopt,
                                            /*root_distance*/ -1});
    bool inserted;
    std::tie(ptr, inserted) = sequence_state->object_id_to_db_row.Insert(
        object_id, id_and_row.row_number);
  }
  return ptr->ToRowReference(object_table);
}

ClassTable::RowReference HeapGraphTracker::GetOrInsertType(
    SequenceState* sequence_state,
    uint64_t type_id) {
  auto class_table = storage_->mutable_heap_graph_class_table();
  auto* ptr = sequence_state->type_id_to_db_row.Find(type_id);
  if (!ptr) {
    auto id_and_row =
        class_table->Insert({StringId(), std::nullopt, std::nullopt});
    bool inserted;
    std::tie(ptr, inserted) = sequence_state->type_id_to_db_row.Insert(
        type_id, id_and_row.row_number);
  }
  return ptr->ToRowReference(class_table);
}

void HeapGraphTracker::AddObject(uint32_t seq_id,
                                 UniquePid upid,
                                 int64_t ts,
                                 SourceObject obj) {
  SequenceState& sequence_state = GetOrCreateSequence(seq_id);

  if (!SetPidAndTimestamp(&sequence_state, upid, ts))
    return;

  sequence_state.last_object_id = obj.object_id;

  ObjectTable::RowReference owner_row_ref =
      GetOrInsertObject(&sequence_state, obj.object_id);
  ClassTable::RowReference type_row_ref =
      GetOrInsertType(&sequence_state, obj.type_id);

  ClassTable::Id type_id = type_row_ref.id();

  owner_row_ref.set_self_size(static_cast<int64_t>(obj.self_size));
  owner_row_ref.set_type_id(type_id);

  if (obj.self_size == 0) {
    sequence_state.deferred_size_objects_for_type_[type_id].push_back(
        owner_row_ref.ToRowNumber());
  }

  uint32_t reference_set_id =
      storage_->heap_graph_reference_table().row_count();
  bool any_references = false;

  ObjectTable::Id owner_id = owner_row_ref.id();
  for (size_t i = 0; i < obj.referred_objects.size(); ++i) {
    uint64_t owned_object_id = obj.referred_objects[i];
    // This is true for unset reference fields.
    std::optional<ObjectTable::RowReference> owned_row_ref;
    if (owned_object_id != 0)
      owned_row_ref = GetOrInsertObject(&sequence_state, owned_object_id);

    auto ref_id_and_row =
        storage_->mutable_heap_graph_reference_table()->Insert(
            {reference_set_id,
             owner_id,
             owned_row_ref ? std::make_optional(owned_row_ref->id())
                           : std::nullopt,
             {},
             {},
             /*deobfuscated_field_name=*/std::nullopt});
    if (!obj.field_name_ids.empty()) {
      sequence_state.references_for_field_name_id[obj.field_name_ids[i]]
          .push_back(ref_id_and_row.row_number);
    }
    any_references = true;
  }
  if (any_references) {
    owner_row_ref.set_reference_set_id(reference_set_id);
    if (obj.field_name_ids.empty()) {
      sequence_state.deferred_reference_objects_for_type_[type_id].push_back(
          owner_row_ref.ToRowNumber());
    }
  }

  if (obj.native_allocation_registry_size.has_value()) {
    sequence_state.nar_size_by_obj_id[owner_id] =
        *obj.native_allocation_registry_size;
  }
}

void HeapGraphTracker::AddRoot(uint32_t seq_id,
                               UniquePid upid,
                               int64_t ts,
                               SourceRoot root) {
  SequenceState& sequence_state = GetOrCreateSequence(seq_id);
  if (!SetPidAndTimestamp(&sequence_state, upid, ts))
    return;

  sequence_state.current_roots.emplace_back(std::move(root));
}

void HeapGraphTracker::AddInternedLocationName(uint32_t seq_id,
                                               uint64_t intern_id,
                                               StringId strid) {
  SequenceState& sequence_state = GetOrCreateSequence(seq_id);
  sequence_state.interned_location_names.emplace(intern_id, strid);
}

void HeapGraphTracker::AddInternedType(uint32_t seq_id,
                                       uint64_t intern_id,
                                       StringId strid,
                                       std::optional<uint64_t> location_id,
                                       uint64_t object_size,
                                       std::vector<uint64_t> field_name_ids,
                                       uint64_t superclass_id,
                                       uint64_t classloader_id,
                                       bool no_fields,
                                       StringId kind) {
  SequenceState& sequence_state = GetOrCreateSequence(seq_id);
  sequence_state.interned_types[intern_id].name = strid;
  sequence_state.interned_types[intern_id].location_id = location_id;
  sequence_state.interned_types[intern_id].object_size = object_size;
  sequence_state.interned_types[intern_id].field_name_ids =
      std::move(field_name_ids);
  sequence_state.interned_types[intern_id].superclass_id = superclass_id;
  sequence_state.interned_types[intern_id].classloader_id = classloader_id;
  sequence_state.interned_types[intern_id].no_fields = no_fields;
  sequence_state.interned_types[intern_id].kind = kind;
}

void HeapGraphTracker::AddInternedFieldName(uint32_t seq_id,
                                            uint64_t intern_id,
                                            base::StringView str) {
  SequenceState& sequence_state = GetOrCreateSequence(seq_id);
  size_t space = str.find(' ');
  base::StringView type;
  if (space != base::StringView::npos) {
    type = str.substr(0, space);
    str = str.substr(space + 1);
  }
  StringId field_name = storage_->InternString(str);
  StringId type_name = storage_->InternString(type);

  sequence_state.interned_fields.Insert(intern_id,
                                        InternedField{field_name, type_name});

  auto it = sequence_state.references_for_field_name_id.find(intern_id);
  if (it != sequence_state.references_for_field_name_id.end()) {
    auto hgr = storage_->mutable_heap_graph_reference_table();
    for (ReferenceTable::RowNumber reference_row_num : it->second) {
      auto row_ref = reference_row_num.ToRowReference(hgr);
      row_ref.set_field_name(field_name);
      row_ref.set_field_type_name(type_name);
      field_to_rows_[field_name].emplace_back(reference_row_num);
    }
  }
}

void HeapGraphTracker::SetPacketIndex(uint32_t seq_id, uint64_t index) {
  SequenceState& sequence_state = GetOrCreateSequence(seq_id);
  bool dropped_packet = false;
  // perfetto_hprof starts counting at index = 0.
  if (!sequence_state.prev_index && index != 0) {
    dropped_packet = true;
  }

  if (sequence_state.prev_index && *sequence_state.prev_index + 1 != index) {
    dropped_packet = true;
  }

  if (dropped_packet) {
    sequence_state.truncated = true;
    if (sequence_state.prev_index) {
      PERFETTO_ELOG("Missing packets between %" PRIu64 " and %" PRIu64,
                    *sequence_state.prev_index, index);
    } else {
      PERFETTO_ELOG("Invalid first packet index %" PRIu64 " (!= 0)", index);
    }

    storage_->IncrementIndexedStats(
        stats::heap_graph_missing_packet,
        static_cast<int>(sequence_state.current_upid));
  }
  sequence_state.prev_index = index;
}

// This only works on Android S+ traces. We need to have ingested the whole
// profile before calling this function (e.g. in FinalizeProfile).
HeapGraphTracker::InternedType* HeapGraphTracker::GetSuperClass(
    SequenceState* sequence_state,
    const InternedType* current_type) {
  if (current_type->superclass_id) {
    auto it = sequence_state->interned_types.find(current_type->superclass_id);
    if (it != sequence_state->interned_types.end())
      return &it->second;
  }
  storage_->IncrementIndexedStats(
      stats::heap_graph_malformed_packet,
      static_cast<int>(sequence_state->current_upid));
  return nullptr;
}

void HeapGraphTracker::FinalizeProfile(uint32_t seq_id) {
  SequenceState& sequence_state = GetOrCreateSequence(seq_id);
  if (sequence_state.truncated) {
    truncated_graphs_.emplace(
        std::make_pair(sequence_state.current_upid, sequence_state.current_ts));
  }

  // We do this in FinalizeProfile because the interned_location_names get
  // written at the end of the dump.
  for (const auto& p : sequence_state.interned_types) {
    uint64_t id = p.first;
    const InternedType& interned_type = p.second;
    std::optional<StringId> location_name;
    if (interned_type.location_id) {
      auto it = sequence_state.interned_location_names.find(
          *interned_type.location_id);
      if (it == sequence_state.interned_location_names.end()) {
        storage_->IncrementIndexedStats(
            stats::heap_graph_invalid_string_id,
            static_cast<int>(sequence_state.current_upid));
      } else {
        location_name = it->second;
      }
    }
    ClassTable::RowReference type_row_ref =
        GetOrInsertType(&sequence_state, id);
    ClassTable::Id type_id = type_row_ref.id();

    auto sz_obj_it =
        sequence_state.deferred_size_objects_for_type_.find(type_id);
    if (sz_obj_it != sequence_state.deferred_size_objects_for_type_.end()) {
      auto* hgo = storage_->mutable_heap_graph_object_table();
      for (ObjectTable::RowNumber obj_row_num : sz_obj_it->second) {
        auto obj_row_ref = obj_row_num.ToRowReference(hgo);
        obj_row_ref.set_self_size(
            static_cast<int64_t>(interned_type.object_size));
      }
      sequence_state.deferred_size_objects_for_type_.erase(sz_obj_it);
    }

    auto ref_obj_it =
        sequence_state.deferred_reference_objects_for_type_.find(type_id);
    if (ref_obj_it !=
        sequence_state.deferred_reference_objects_for_type_.end()) {
      for (ObjectTable::RowNumber obj_row_number : ref_obj_it->second) {
        auto obj_row_ref = obj_row_number.ToRowReference(
            storage_->mutable_heap_graph_object_table());
        const InternedType* current_type = &interned_type;
        if (interned_type.no_fields) {
          continue;
        }
        size_t field_offset_in_cls = 0;
        ForReferenceSet(
            storage_, obj_row_ref,
            [this, &current_type, &sequence_state,
             &field_offset_in_cls](ReferenceTable::RowReference ref) {
              while (current_type && field_offset_in_cls >=
                                         current_type->field_name_ids.size()) {
                size_t prev_type_size = current_type->field_name_ids.size();
                current_type = GetSuperClass(&sequence_state, current_type);
                field_offset_in_cls -= prev_type_size;
              }

              if (!current_type) {
                return false;
              }

              uint64_t field_id =
                  current_type->field_name_ids[field_offset_in_cls++];
              auto* ptr = sequence_state.interned_fields.Find(field_id);
              if (!ptr) {
                PERFETTO_DLOG("Invalid field id.");
                storage_->IncrementIndexedStats(
                    stats::heap_graph_malformed_packet,
                    static_cast<int>(sequence_state.current_upid));
                return true;
              }
              const InternedField& field = *ptr;
              ref.set_field_name(field.name);
              ref.set_field_type_name(field.type_name);
              field_to_rows_[field.name].emplace_back(ref.ToRowNumber());
              return true;
            });
      }
      sequence_state.deferred_reference_objects_for_type_.erase(ref_obj_it);
    }

    type_row_ref.set_name(interned_type.name);
    if (interned_type.classloader_id) {
      auto classloader_object_ref =
          GetOrInsertObject(&sequence_state, interned_type.classloader_id);
      type_row_ref.set_classloader_id(classloader_object_ref.id().value);
    }
    if (location_name)
      type_row_ref.set_location(*location_name);
    type_row_ref.set_kind(interned_type.kind);

    base::StringView normalized_type =
        NormalizeTypeName(storage_->GetString(interned_type.name));

    std::optional<StringId> class_package;
    if (location_name) {
      std::optional<std::string> package_name =
          PackageFromLocation(storage_, storage_->GetString(*location_name));
      if (package_name) {
        class_package = storage_->InternString(base::StringView(*package_name));
      }
    }
    if (!class_package) {
      auto app_id = storage_->process_table()
                        .android_appid()[sequence_state.current_upid];
      if (app_id) {
        auto pkg_row = storage_->package_list_table().uid().IndexOf(*app_id);
        if (pkg_row) {
          class_package =
              storage_->package_list_table().package_name()[*pkg_row];
        }
      }
    }

    class_to_rows_[std::make_pair(class_package,
                                  storage_->InternString(normalized_type))]
        .emplace_back(type_row_ref.ToRowNumber());
  }

  if (!sequence_state.deferred_size_objects_for_type_.empty() ||
      !sequence_state.deferred_reference_objects_for_type_.empty()) {
    storage_->IncrementIndexedStats(
        stats::heap_graph_malformed_packet,
        static_cast<int>(sequence_state.current_upid));
  }

  for (const SourceRoot& root : sequence_state.current_roots) {
    for (uint64_t obj_id : root.object_ids) {
      auto ptr = sequence_state.object_id_to_db_row.Find(obj_id);
      // This can only happen for an invalid type string id, which is already
      // reported as an error. Silently continue here.
      if (!ptr)
        continue;

      ObjectTable::RowReference row_ref =
          ptr->ToRowReference(storage_->mutable_heap_graph_object_table());
      auto it_and_success = roots_[std::make_pair(sequence_state.current_upid,
                                                  sequence_state.current_ts)]
                                .emplace(*ptr);
      if (it_and_success.second) {
        MarkRoot(storage_, row_ref, InternRootTypeString(root.root_type));
      }
    }
  }

  PopulateSuperClasses(sequence_state);
  PopulateNativeSize(sequence_state);
  sequence_state_.erase(seq_id);
}

std::optional<ObjectTable::Id> HeapGraphTracker::GetReferenceByFieldName(
    ObjectTable::Id obj,
    StringId field) {
  std::optional<ObjectTable::Id> referred;
  auto obj_row_ref = *storage_->heap_graph_object_table().FindById(obj);
  ForReferenceSet(storage_, obj_row_ref,
                  [&](ReferenceTable::RowReference ref) -> bool {
                    if (ref.field_name() == field) {
                      referred = ref.owned_id();
                      return false;
                    }
                    return true;
                  });
  return referred;
}

void HeapGraphTracker::PopulateNativeSize(const SequenceState& seq) {
  //             +-------------------------------+  .referent   +--------+
  //             |       sun.misc.Cleaner        | -----------> | Object |
  //             +-------------------------------+              +--------+
  //                |
  //                | .thunk
  //                v
  // +----------------------------------------------------+
  // | libcore.util.NativeAllocationRegistry$CleanerThunk |
  // +----------------------------------------------------+
  //   |
  //   | .this$0
  //   v
  // +----------------------------------------------------+
  // |       libcore.util.NativeAllocationRegistry        |
  // |                       .size                        |
  // +----------------------------------------------------+
  //
  // `.size` should be attributed as the native size of Object

  const auto& class_tbl = storage_->heap_graph_class_table();
  auto& objects_tbl = *storage_->mutable_heap_graph_object_table();

  struct Cleaner {
    ObjectTable::Id referent;
    ObjectTable::Id thunk;
  };
  std::vector<Cleaner> cleaners;

  auto class_it =
      class_tbl.FilterToIterator({class_tbl.name().eq("sun.misc.Cleaner")});
  for (; class_it; ++class_it) {
    auto class_id = class_it.id();
    auto obj_it = objects_tbl.FilterToIterator(
        {objects_tbl.type_id().eq(class_id.value),
         objects_tbl.upid().eq(seq.current_upid),
         objects_tbl.graph_sample_ts().eq(seq.current_ts)});
    for (; obj_it; ++obj_it) {
      ObjectTable::Id cleaner_obj_id = obj_it.id();
      std::optional<ObjectTable::Id> referent_id =
          GetReferenceByFieldName(cleaner_obj_id, referent_str_id_);
      std::optional<ObjectTable::Id> thunk_id =
          GetReferenceByFieldName(cleaner_obj_id, cleaner_thunk_str_id_);

      if (!referent_id || !thunk_id) {
        continue;
      }

      std::optional<ObjectTable::Id> next_id =
          GetReferenceByFieldName(cleaner_obj_id, cleaner_next_str_id_);
      if (next_id.has_value() && *next_id == cleaner_obj_id) {
        // sun.misc.Cleaner.next points to the sun.misc.Cleaner: this means
        // that the sun.misc.Cleaner.clean() has already been called. Skip this.
        continue;
      }
      cleaners.push_back(Cleaner{*referent_id, *thunk_id});
    }
  }

  for (const auto& cleaner : cleaners) {
    std::optional<ObjectTable::Id> this0 =
        GetReferenceByFieldName(cleaner.thunk, cleaner_thunk_this0_str_id_);
    if (!this0) {
      continue;
    }

    auto nar_size_it = seq.nar_size_by_obj_id.find(*this0);
    if (nar_size_it == seq.nar_size_by_obj_id.end()) {
      continue;
    }

    int64_t native_size =
        GetSizeFromNativeAllocationRegistry(nar_size_it->second);
    auto referent_row_ref = *objects_tbl.FindById(cleaner.referent);
    int64_t total_native_size = referent_row_ref.native_size() + native_size;
    referent_row_ref.set_native_size(total_native_size);
  }
}

// TODO(fmayer): For Android S+ traces, use the superclass_id from the trace.
void HeapGraphTracker::PopulateSuperClasses(const SequenceState& seq) {
  // Maps from normalized class name and location, to superclass.
  std::map<ClassDescriptor, ClassDescriptor> superclass_map =
      BuildSuperclassMap(seq.current_upid, seq.current_ts, storage_);

  auto* classes_tbl = storage_->mutable_heap_graph_class_table();
  std::map<ClassDescriptor, ClassTable::Id> class_to_id;
  for (uint32_t idx = 0; idx < classes_tbl->row_count(); ++idx) {
    class_to_id[{classes_tbl->name()[idx], classes_tbl->location()[idx]}] =
        classes_tbl->id()[idx];
  }

  // Iterate through the classes table and annotate with superclasses.
  // We iterate all rows on the classes table (even though the superclass
  // mapping was generated on the current sequence) - if we cannot identify
  // a superclass we will just skip.
  for (uint32_t idx = 0; idx < classes_tbl->row_count(); ++idx) {
    auto name = storage_->GetString(classes_tbl->name()[idx]);
    auto location = classes_tbl->location()[idx];
    auto normalized = GetNormalizedType(name);
    if (normalized.is_static_class || normalized.number_of_arrays > 0)
      continue;

    StringId class_name_id = storage_->InternString(normalized.name);
    auto map_it = superclass_map.find({class_name_id, location});
    if (map_it == superclass_map.end()) {
      continue;
    }

    // Find the row for the superclass id
    auto superclass_it = class_to_id.find(map_it->second);
    if (superclass_it == class_to_id.end()) {
      // This can happen for traces was captured before the patch to
      // explicitly emit interned types (meaning classes without live
      // instances would not appear here).
      continue;
    }
    auto superclass_id = superclass_it->second;
    // Mutate the superclass column
    classes_tbl->mutable_superclass_id()->Set(idx, superclass_id);
  }
}

void FindPathFromRoot(TraceStorage* storage,
                      ObjectTable::RowReference row_ref,
                      PathFromRoot* path) {
  // We have long retention chains (e.g. from LinkedList). If we use the stack
  // here, we risk running out of stack space. This is why we use a vector to
  // simulate the stack.
  struct StackElem {
    ObjectTable::RowReference node;  // Node in the original graph.
    size_t parent_id;                // id of parent node in the result tree.
    size_t i;        // Index of the next child of this node to handle.
    uint32_t depth;  // Depth in the resulting tree
                     // (including artificial root).
    std::vector<ObjectTable::Id> children;
  };

  std::vector<StackElem> stack{{row_ref, PathFromRoot::kRoot, 0, 0, {}}};

  while (!stack.empty()) {
    ObjectTable::RowReference object_row_ref = stack.back().node;

    size_t parent_id = stack.back().parent_id;
    uint32_t depth = stack.back().depth;
    size_t& i = stack.back().i;
    std::vector<ObjectTable::Id>& children = stack.back().children;

    ClassTable::Id type_id = object_row_ref.type_id();

    auto type_row_ref = *storage->heap_graph_class_table().FindById(type_id);
    std::optional<StringId> opt_class_name_id =
        type_row_ref.deobfuscated_name();
    if (!opt_class_name_id) {
      opt_class_name_id = type_row_ref.name();
    }
    PERFETTO_CHECK(opt_class_name_id);
    StringId class_name_id = *opt_class_name_id;
    std::optional<StringId> root_type = object_row_ref.root_type();
    if (root_type) {
      class_name_id = storage->InternString(base::StringView(
          storage->GetString(class_name_id).ToStdString() + " [" +
          storage->GetString(*root_type).ToStdString() + "]"));
    }
    auto it = path->nodes[parent_id].children.find(class_name_id);
    if (it == path->nodes[parent_id].children.end()) {
      size_t path_id = path->nodes.size();
      path->nodes.emplace_back(PathFromRoot::Node{});
      std::tie(it, std::ignore) =
          path->nodes[parent_id].children.emplace(class_name_id, path_id);
      path->nodes.back().class_name_id = class_name_id;
      path->nodes.back().depth = depth;
      path->nodes.back().parent_id = parent_id;
    }
    size_t path_id = it->second;
    PathFromRoot::Node* output_tree_node = &path->nodes[path_id];

    if (i == 0) {
      // This is the first time we are looking at this node, so add its
      // size to the relevant node in the resulting tree.
      output_tree_node->size += object_row_ref.self_size();
      output_tree_node->count++;
      base::FlatSet<ObjectTable::Id> children_set =
          GetChildren(storage, object_row_ref);
      children.assign(children_set.begin(), children_set.end());
      PERFETTO_CHECK(children.size() == children_set.size());

      if (object_row_ref.native_size()) {
        StringId native_class_name_id = storage->InternString(
            base::StringView(std::string("[native] ") +
                             storage->GetString(class_name_id).ToStdString()));
        std::map<StringId, size_t>::iterator native_it;
        bool inserted_new_node;
        std::tie(native_it, inserted_new_node) =
            path->nodes[path_id].children.insert({native_class_name_id, 0});
        if (inserted_new_node) {
          native_it->second = path->nodes.size();
          path->nodes.emplace_back(PathFromRoot::Node{});

          path->nodes.back().class_name_id = native_class_name_id;
          path->nodes.back().depth = depth + 1;
          path->nodes.back().parent_id = path_id;
        }
        PathFromRoot::Node* new_output_tree_node =
            &path->nodes[native_it->second];

        new_output_tree_node->size += object_row_ref.native_size();
        new_output_tree_node->count++;
      }
    }

    // We have already handled this node and just need to get its i-th child.
    if (!children.empty()) {
      PERFETTO_CHECK(i < children.size());
      ObjectTable::Id child = children[i];
      auto child_row_ref =
          *storage->mutable_heap_graph_object_table()->FindById(child);
      if (++i == children.size())
        stack.pop_back();

      int32_t child_distance = child_row_ref.root_distance();
      int32_t n_distance = object_row_ref.root_distance();
      PERFETTO_CHECK(n_distance >= 0);
      PERFETTO_CHECK(child_distance >= 0);

      bool visited = path->visited.count(child);

      if (child_distance == n_distance + 1 && !visited) {
        path->visited.emplace(child);
        stack.emplace_back(StackElem{child_row_ref, path_id, 0, depth + 1, {}});
      }
    } else {
      stack.pop_back();
    }
  }
}

std::unique_ptr<tables::ExperimentalFlamegraphNodesTable>
HeapGraphTracker::BuildFlamegraph(const int64_t current_ts,
                                  const UniquePid current_upid) {
  auto profile_type = storage_->InternString("graph");
  auto java_mapping = storage_->InternString("JAVA");

  std::unique_ptr<tables::ExperimentalFlamegraphNodesTable> tbl(
      new tables::ExperimentalFlamegraphNodesTable(
          storage_->mutable_string_pool()));

  auto it = roots_.find(std::make_pair(current_upid, current_ts));
  if (it == roots_.end()) {
    // TODO(fmayer): This should not be within the flame graph but some marker
    // in the UI.
    if (IsTruncated(current_upid, current_ts)) {
      tables::ExperimentalFlamegraphNodesTable::Row alloc_row{};
      alloc_row.ts = current_ts;
      alloc_row.upid = current_upid;
      alloc_row.profile_type = profile_type;
      alloc_row.depth = 0;
      alloc_row.name = storage_->InternString(
          "ERROR: INCOMPLETE GRAPH (try increasing buffer size)");
      alloc_row.map_name = java_mapping;
      alloc_row.count = 1;
      alloc_row.cumulative_count = 1;
      alloc_row.size = 1;
      alloc_row.cumulative_size = 1;
      alloc_row.parent_id = std::nullopt;
      tbl->Insert(alloc_row);
      return tbl;
    }
    // We haven't seen this graph, so we should raise an error.
    return nullptr;
  }

  const std::set<ObjectTable::RowNumber>& roots = it->second;
  auto* object_table = storage_->mutable_heap_graph_object_table();

  // First pass to calculate shortest paths
  for (ObjectTable::RowNumber root : roots) {
    UpdateShortestPaths(storage_, root.ToRowReference(object_table));
  }
  PathFromRoot init_path;
  for (ObjectTable::RowNumber root : roots) {
    FindPathFromRoot(storage_, root.ToRowReference(object_table), &init_path);
  }

  std::vector<int64_t> node_to_cumulative_size(init_path.nodes.size());
  std::vector<int64_t> node_to_cumulative_count(init_path.nodes.size());
  // i > 0 is to skip the artifical root node.
  for (size_t i = init_path.nodes.size() - 1; i > 0; --i) {
    const PathFromRoot::Node& node = init_path.nodes[i];

    node_to_cumulative_size[i] += node.size;
    node_to_cumulative_count[i] += node.count;
    node_to_cumulative_size[node.parent_id] += node_to_cumulative_size[i];
    node_to_cumulative_count[node.parent_id] += node_to_cumulative_count[i];
  }

  std::vector<FlamegraphId> node_to_id(init_path.nodes.size());
  // i = 1 is to skip the artifical root node.
  for (size_t i = 1; i < init_path.nodes.size(); ++i) {
    const PathFromRoot::Node& node = init_path.nodes[i];
    PERFETTO_CHECK(node.parent_id < i);
    std::optional<FlamegraphId> parent_id;
    if (node.parent_id != 0)
      parent_id = node_to_id[node.parent_id];
    const uint32_t depth = node.depth;

    tables::ExperimentalFlamegraphNodesTable::Row alloc_row{};
    alloc_row.ts = current_ts;
    alloc_row.upid = current_upid;
    alloc_row.profile_type = profile_type;
    alloc_row.depth = depth;
    alloc_row.name = node.class_name_id;
    alloc_row.map_name = java_mapping;
    alloc_row.count = static_cast<int64_t>(node.count);
    alloc_row.cumulative_count =
        static_cast<int64_t>(node_to_cumulative_count[i]);
    alloc_row.size = static_cast<int64_t>(node.size);
    alloc_row.cumulative_size =
        static_cast<int64_t>(node_to_cumulative_size[i]);
    alloc_row.parent_id = parent_id;
    node_to_id[i] = tbl->Insert(alloc_row).id;
  }
  return tbl;
}

void HeapGraphTracker::FinalizeAllProfiles() {
  if (!sequence_state_.empty()) {
    storage_->IncrementStats(stats::heap_graph_non_finalized_graph);
    // There might still be valuable data even though the trace is truncated.
    while (!sequence_state_.empty()) {
      FinalizeProfile(sequence_state_.begin()->first);
    }
  }
}

bool HeapGraphTracker::IsTruncated(UniquePid upid, int64_t ts) {
  // The graph was finalized but was missing packets.
  if (truncated_graphs_.find(std::make_pair(upid, ts)) !=
      truncated_graphs_.end()) {
    return true;
  }

  // Or the graph was never finalized, so is missing packets at the end.
  for (const auto& p : sequence_state_) {
    const SequenceState& sequence_state = p.second;
    if (sequence_state.current_upid == upid &&
        sequence_state.current_ts == ts) {
      return true;
    }
  }
  return false;
}

StringId HeapGraphTracker::InternRootTypeString(
    protos::pbzero::HeapGraphRoot::Type root_type) {
  size_t idx = static_cast<size_t>(root_type);
  if (idx >= root_type_string_ids_.size()) {
    idx = static_cast<size_t>(protos::pbzero::HeapGraphRoot::ROOT_UNKNOWN);
  }

  return root_type_string_ids_[idx];
}

HeapGraphTracker::~HeapGraphTracker() = default;

}  // namespace trace_processor
}  // namespace perfetto

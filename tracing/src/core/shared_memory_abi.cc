/*
 * Copyright (C) 2017 The Android Open Source Project
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

#include "tracing/core/shared_memory_abi.h"

#include <sys/mman.h>

#include <bitset>  // temporary, for debugging. remove

#include "base/logging.h"
#include "base/utils.h"
#include "tracing/core/basic_types.h"

namespace perfetto {

namespace {
// Returns the largest 4-bytes aligned chunk size <= |page_size| / |divider|
// for each divider in PageLayout.
constexpr size_t GetChunkSize(size_t page_size, size_t divider) {
  return ((page_size - sizeof(SharedMemoryABI::PageHeader)) / divider) & ~3UL;
}

std::array<size_t, SharedMemoryABI::kNumPageLayouts> InitChunkSizes(
    size_t page_size) {
  static_assert(SharedMemoryABI::kNumPageLayouts ==
                    base::ArraySize(SharedMemoryABI::kNumChunksForLayout),
                "kNumPageLayouts out of date");
  std::array<size_t, SharedMemoryABI::kNumPageLayouts> res = {};
  for (size_t i = 0; i < SharedMemoryABI::kNumPageLayouts; i++) {
    size_t num_chunks = SharedMemoryABI::kNumChunksForLayout[i];
    res[i] = num_chunks == 0 ? 0 : GetChunkSize(page_size, num_chunks);
  }
  return res;
}

}  // namespace

// static
constexpr size_t SharedMemoryABI::kNumChunksForLayout[];
constexpr const char* SharedMemoryABI::kChunkStateStr[];

SharedMemoryABI::SharedMemoryABI(void* start, size_t size, size_t page_size)
    : start_(reinterpret_cast<uintptr_t>(start)),
      size_(size),
      page_size_(page_size),
      num_pages_(size / page_size),
      chunk_sizes_(InitChunkSizes(page_size)) {
  static_assert(sizeof(PageHeader) == 8, "PageHeader size");
  static_assert(sizeof(ChunkHeader) == 8, "ChunkHeader size");
  static_assert(sizeof(ChunkHeader::PacketsState) == 4, "PacketsState size");
  static_assert(alignof(ChunkHeader) == kChunkAlignment,
                "ChunkHeader alignment");

  // In theory std::atomic does not guarantee that the underlying type consists
  // only of the actual atomic word. Theoretically it could have locks or other
  // state. In practice most implementations just implement them wihtout extra
  // state. The code below overlays the atomic into the SMB, hence relies on
  // this implementation detail. This should be fine pragmatically (Chrome's
  // base makes the same assumption), but let's have a check for this.
  static_assert(sizeof(std::atomic<uint32_t>) == sizeof(uint32_t) &&
                    sizeof(std::atomic<uint16_t>) == sizeof(uint16_t),
                "Incompatible STL atomic implementation");

  // Sanity check the consistency of the kMax... constants.
  ChunkHeader::Identifier chunk_id = {};
  PERFETTO_CHECK((chunk_id.writer_id -= 1) == kMaxWriterID);

  PageHeader phdr;
  phdr.target_buffer.store(-1);
  PERFETTO_CHECK(phdr.target_buffer.load() >= kMaxTraceBuffers - 1);

  PERFETTO_CHECK(page_size >= 4096);
  PERFETTO_CHECK(page_size % 4096 == 0);
  PERFETTO_CHECK(page_size <= kMaxPageSize);
  PERFETTO_CHECK(size % page_size == 0);
}

SharedMemoryABI::ChunkState SharedMemoryABI::GetChunkState(size_t page_idx,
                                                           size_t chunk_idx) {
  PageHeader* phdr = page_header(page_idx);
  uint32_t layout = phdr->layout.load(std::memory_order_relaxed);
  return static_cast<ChunkState>((layout >> (chunk_idx * kChunkShift)) &
                                 kChunkMask);
}

SharedMemoryABI::Chunk SharedMemoryABI::GetChunk(size_t page_idx,
                                                 size_t chunk_idx) {
  PageHeader* phdr = page_header(page_idx);
  uint32_t layout = phdr->layout.load(std::memory_order_relaxed);
  const size_t num_chunks = GetNumChunksForLayout(layout);

  // The page layout has changed (or the page is free).
  if (chunk_idx >= num_chunks)
    return Chunk();

  // Compute the chunk virtual address and write it into |chunk|.
  uintptr_t page_start = start_ + page_idx * page_size_;
  const size_t chunk_size = GetChunkSizeForPage(layout);
  uintptr_t chunk_offset_in_page = sizeof(PageHeader) + chunk_idx * chunk_size;
  Chunk chunk(page_start + chunk_offset_in_page, chunk_size);
  PERFETTO_DCHECK(chunk.end() <= end());
  return chunk;
}

SharedMemoryABI::ChunkHeader* SharedMemoryABI::GetChunkHeader(
    size_t page_idx,
    size_t chunk_idx) {
  Chunk chunk = GetChunk(page_idx, chunk_idx);
  return chunk.is_valid() ? chunk.header() : nullptr;
}

SharedMemoryABI::Chunk SharedMemoryABI::GetChunkUnchecked(size_t page_idx,
                                                          uint32_t page_layout,
                                                          size_t chunk_idx) {
  const size_t num_chunks = GetNumChunksForLayout(page_layout);
  PERFETTO_DCHECK(chunk_idx < num_chunks);
  // Compute the chunk virtual address and write it into |chunk|.
  uintptr_t page_start = start_ + page_idx * page_size_;
  const size_t chunk_size = GetChunkSizeForPage(page_layout);
  uintptr_t chunk_offset_in_page = sizeof(PageHeader) + chunk_idx * chunk_size;

  Chunk chunk(page_start + chunk_offset_in_page, chunk_size);
  PERFETTO_DCHECK(chunk.end() <= end());
  return chunk;
}

SharedMemoryABI::Chunk SharedMemoryABI::TryAcquireChunk(
    size_t page_idx,
    size_t chunk_idx,
    ChunkState desired_chunk_state,
    const ChunkHeader* header) {
  PERFETTO_DCHECK(desired_chunk_state == kChunkBeingRead ||
                  desired_chunk_state == kChunkBeingWritten);
  PageHeader* phdr = page_header(page_idx);
  uint32_t layout = phdr->layout.load(std::memory_order_relaxed);
  const size_t num_chunks = GetNumChunksForLayout(layout);

  // The page layout has changed (or the page is free).
  if (chunk_idx >= num_chunks)
    return Chunk();

  // Verify that the chunk is still in a state that allows the transitiont to
  // |desired_chunk_state|. The only allowed transitions are:
  // 1. kChunkFree -> kChunkBeingWritten (Producer).
  // 2. kChunkComplete -> kChunkBeingRead (Service).
  ChunkState expected_chunk_state =
      desired_chunk_state == kChunkBeingWritten ? kChunkFree : kChunkComplete;
  auto cur_chunk_state = (layout >> (chunk_idx * kChunkShift)) & kChunkMask;
  if (cur_chunk_state != expected_chunk_state)
    return Chunk();

  uint32_t next_layout = layout;
  next_layout &= ~(kChunkMask << (chunk_idx * kChunkShift));
  next_layout |= (desired_chunk_state << (chunk_idx * kChunkShift));
  if (!phdr->layout.compare_exchange_strong(layout, next_layout,
                                            std::memory_order_acq_rel)) {
    // TODO: returning here is too aggressive. We should look at the returned
    // |layout| to figure out if somebody else took the same chunk (in which
    // case we should immediately return false) or if they took another chunk in
    // the same page (in which case we should just retry).
    return Chunk();
  }

  // Compute the chunk virtual address and write it into |chunk|.
  Chunk chunk = GetChunkUnchecked(page_idx, layout, chunk_idx);
  if (desired_chunk_state == kChunkBeingWritten) {
    PERFETTO_DCHECK(header);
    ChunkHeader* new_header = chunk.header();
    new_header->packets.store(header->packets, std::memory_order_relaxed);
    new_header->identifier.store(header->identifier, std::memory_order_release);
  }
  return chunk;
}

bool SharedMemoryABI::TryPartitionPage(size_t page_idx,
                                       PageLayout layout,
                                       size_t target_buffer) {
  uint32_t expected_state = 0;
  uint32_t next_layout = (layout << kLayoutShift) & kLayoutMask;
  PageHeader* phdr = page_header(page_idx);
  if (!phdr->layout.compare_exchange_strong(expected_state, next_layout,
                                            std::memory_order_acq_rel)) {
    return false;
  }

  PERFETTO_DCHECK(target_buffer < kMaxTraceBuffers);
  phdr->target_buffer.store(static_cast<uint16_t>(target_buffer),
                            std::memory_order_release);
  return true;
}

size_t SharedMemoryABI::GetTargetBuffer(size_t page_idx) {
  // TODO: should this be acquire? This is a tricky one. Think.
  return page_header(page_idx)->target_buffer.load(std::memory_order_relaxed);
}

size_t SharedMemoryABI::GetFreeChunks(size_t page_idx) {
  uint32_t layout =
      page_header(page_idx)->layout.load(std::memory_order_relaxed);
  const size_t num_chunks = GetNumChunksForLayout(layout);
  size_t res = 0;
  for (size_t i = 0; i < num_chunks; i++) {
    res |= ((layout & kChunkMask) == kChunkFree) ? (1 << i) : 0;
    layout >>= kChunkShift;
  }
  return res;
}

size_t SharedMemoryABI::ReleaseChunk(Chunk chunk,
                                     ChunkState desired_chunk_state) {
  PERFETTO_DCHECK(desired_chunk_state == kChunkComplete ||
                  desired_chunk_state == kChunkFree);

  size_t page_idx;
  size_t chunk_idx;
  std::tie(page_idx, chunk_idx) = GetPageAndChunkIndex(chunk);

  for (int attempt = 0; attempt < 64; attempt++) {
    PageHeader* phdr = page_header(page_idx);
    uint32_t layout = phdr->layout.load(std::memory_order_relaxed);
    const size_t page_chunk_size = GetChunkSizeForPage(layout);
    PERFETTO_CHECK(chunk.size() == page_chunk_size);
    const uint32_t chunk_state =
        ((layout >> (chunk_idx * kChunkShift)) & kChunkMask);

    // Verify that the chunk is still in a state that allows the transitiont to
    // |desired_chunk_state|. The only allowed transitions are:
    // 1. kChunkBeingWritten -> kChunkComplete (Producer).
    // 2. kChunkBeingRead -> kChunkFree (Service).
    ChunkState expected_chunk_state;
    uint32_t all_chunks_state;
    if (desired_chunk_state == kChunkComplete) {
      expected_chunk_state = kChunkBeingWritten;
      all_chunks_state = kAllChunksComplete;
    } else {
      expected_chunk_state = kChunkBeingRead;
      all_chunks_state = kAllChunksFree;
    }
    const size_t num_chunks = GetNumChunksForLayout(layout);
    all_chunks_state &= (1 << (num_chunks * kChunkShift)) - 1;
    PERFETTO_CHECK(chunk_state == expected_chunk_state);
    uint32_t next_layout = layout;
    next_layout &= ~(kChunkMask << (chunk_idx * kChunkShift));
    next_layout |= (desired_chunk_state << (chunk_idx * kChunkShift));

    // If we are freeing a chunk and all the other chunks in the page are free
    // we should de-partition the page and mark it as clear.
    // TODO: maybe even madvise() it?
    if ((next_layout & kAllChunksMask) == kAllChunksFree)
      next_layout = 0;

    if (phdr->layout.compare_exchange_strong(layout, next_layout,
                                             std::memory_order_acq_rel)) {
      return (next_layout & kAllChunksMask) == all_chunks_state
                 ? page_idx
                 : kInvalidPageIdx;
    }
    std::this_thread::yield();
  }
  // Too much contention on this page. Give up. This page will be left pending
  // forever but there isn't much more we can do at this point.
  PERFETTO_DCHECK(false);
  return kInvalidPageIdx;
}

bool SharedMemoryABI::TryAcquireAllChunksForReading(size_t page_idx) {
  PageHeader* phdr = page_header(page_idx);
  uint32_t layout = phdr->layout.load(std::memory_order_relaxed);
  const size_t num_chunks = GetNumChunksForLayout(layout);
  if (num_chunks == 0)
    return false;
  uint32_t next_layout = layout & kLayoutMask;
  for (size_t chunk_idx = 0; chunk_idx < num_chunks; chunk_idx++) {
    const uint32_t chunk_state =
        ((layout >> (chunk_idx * kChunkShift)) & kChunkMask);
    switch (chunk_state) {
      case kChunkBeingWritten:
        return false;
      case kChunkBeingRead:
      case kChunkComplete:
        next_layout |= kChunkBeingRead << (chunk_idx * kChunkShift);
        break;
      case kChunkFree:
        next_layout |= kChunkFree << (chunk_idx * kChunkShift);
        break;
    }
  }
  return phdr->layout.compare_exchange_strong(layout, next_layout,
                                              std::memory_order_acq_rel);
}

void SharedMemoryABI::ReleaseAllChunksAsFree(size_t page_idx) {
  PageHeader* phdr = page_header(page_idx);
  phdr->layout.store(0, std::memory_order_release);
  uintptr_t page_start = start_ + page_idx * page_size_;
  // TODO: On Linux/Android this should be MADV_REMOVE if we use memfd_create()
  // and tmpfs supports hole punching (need to consult kernel sources).
  int ret =
      madvise(reinterpret_cast<void*>(page_start), page_size_, MADV_DONTNEED);
  PERFETTO_DCHECK(ret == 0);
}

SharedMemoryABI::Chunk::Chunk() = default;

SharedMemoryABI::Chunk::Chunk(uintptr_t begin, size_t size)
    : begin_(begin), end_(begin + size) {
  PERFETTO_CHECK(begin % kChunkAlignment == 0);
  PERFETTO_CHECK(end_ >= begin_);
}

std::pair<uint16_t, uint8_t> SharedMemoryABI::Chunk::GetPacketCountAndFlags() {
  auto state = header()->packets.load(std::memory_order_acquire);
  return std::make_pair(state.count, state.flags);
}

void SharedMemoryABI::Chunk::IncrementPacketCount(bool last_packet_is_partial) {
  // A chunk state is supposed to be modified only by the Producer and only by
  // one thread. There is no need of CAS here (if the caller behaves properly).
  ChunkHeader* chunk_header = header();
  auto packets = chunk_header->packets.load(std::memory_order_relaxed);
  packets.count++;
  if (last_packet_is_partial)
    packets.flags |= ChunkHeader::kLastPacketContinuesOnNextChunk;

  // This needs to be a release store because if the Service sees this, it also
  // has to be guaranteed to see all the previous stores for the protobuf packet
  // bytes.
  chunk_header->packets.store(packets, std::memory_order_release);
}

std::pair<size_t, size_t> SharedMemoryABI::GetPageAndChunkIndex(
    const Chunk& chunk) {
  PERFETTO_CHECK(chunk.is_valid());
  PERFETTO_CHECK(chunk.begin_addr() >= start_);
  PERFETTO_CHECK(chunk.end_addr() <= start_ + size_);

  // TODO: this could be optimized if we cache |page_shift_|.
  const uintptr_t rel_addr = chunk.begin_addr() - start_;
  const size_t page_idx = rel_addr / page_size_;
  const size_t offset = rel_addr % page_size_;
  PERFETTO_CHECK(offset >= sizeof(PageHeader));
  PERFETTO_CHECK(offset % kChunkAlignment == 0);
  PERFETTO_CHECK((offset - sizeof(PageHeader)) % chunk.size() == 0);
  const size_t chunk_idx = (offset - sizeof(PageHeader)) / chunk.size();
  PERFETTO_CHECK(chunk_idx < kMaxChunksPerPage);
  return std::make_pair(page_idx, chunk_idx);
}

}  // namespace perfetto

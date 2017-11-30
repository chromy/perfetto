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

#include "ftrace_reader/ftrace_controller.h"

#include <fcntl.h>
#include <stdint.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#include <array>
#include <string>

#include "base/logging.h"
#include "base/utils.h"
#include "cpu_reader.h"
#include "ftrace_procfs.h"
#include "proto_translation_table.h"

#include "protos/ftrace/ftrace_event_bundle.pbzero.h"

namespace perfetto {
namespace {

// TODO(b/68242551): Do not hardcode these paths.
const char kTracingPath[] = "/sys/kernel/debug/tracing/";

#if defined(ANDROID)
bool RunAtrace(const std::vector<std::string>& args) {
  std::string cmd = "atrace";
  for (const std::string& arg : args) {
    cmd += " ";
    cmd += arg;
  }
  PERFETTO_DLOG("%s", cmd.c_str());
  int status = 1;
  char* const envp[1] = {nullptr};
  pid_t pid = fork();
  if (pid == -1)
    return false;
  if (pid > 0) {
    waitpid(pid, &status, 0);
  } else {
    std::vector<char*> argv;
    char argv_arena[1024];
    char* wptr = &argv_arena[0];
    argv.push_back(wptr);
    strcpy(wptr, "atrace");
    wptr += strlen("atrace") + 1;
    for (const auto& arg : args) {
      argv.push_back(wptr);
      strcpy(wptr, arg.c_str());
      wptr += arg.size() + 1;
    }
    argv.push_back(nullptr);
    int devnull_fd = open("/dev/null", O_WRONLY);
    dup2(devnull_fd, STDOUT_FILENO);
    execve("/system/bin/atrace", &argv[0], envp);
    exit(1);
  }
  return status == 0;
}
#endif  // defined(ANDROID)

}  // namespace

// static
std::unique_ptr<FtraceController> FtraceController::Create(
    base::TaskRunner* runner) {
  auto ftrace_procfs =
      std::unique_ptr<FtraceProcfs>(new FtraceProcfs(kTracingPath));
  auto table = ProtoTranslationTable::Create(ftrace_procfs.get());
  return std::unique_ptr<FtraceController>(
      new FtraceController(std::move(ftrace_procfs), runner, std::move(table)));
}

FtraceController::FtraceController(std::unique_ptr<FtraceProcfs> ftrace_procfs,
                                   base::TaskRunner* task_runner,
                                   std::unique_ptr<ProtoTranslationTable> table)
    : ftrace_procfs_(std::move(ftrace_procfs)),
      task_runner_(task_runner),
      weak_factory_(this),
      enabled_count_(table->largest_id() + 1),
      table_(std::move(table)) {}

FtraceController::~FtraceController() {
  for (size_t id = 1; id <= table_->largest_id(); id++) {
    if (enabled_count_[id]) {
      const ProtoTranslationTable::Event* event = table_->GetEventById(id);
      ftrace_procfs_->DisableEvent(event->group, event->name);
    }
  }
}

void FtraceController::ClearTrace() {
  ftrace_procfs_->ClearTrace();
}

void FtraceController::DisableAllEvents() {
  ftrace_procfs_->DisableAllEvents();
}

void FtraceController::WriteTraceMarker(const std::string& s) {
  ftrace_procfs_->WriteTraceMarker(s);
}

const int kDrainPeriodMs = 100;

// static
void FtraceController::PeriodicDrainCPU(
    base::WeakPtr<FtraceController> weak_this,
    int cpu) {
  if (!weak_this)
    return;  // The controller might be gone.
  if (!weak_this->listening_for_raw_trace_data_)
    return;

  bool has_more = weak_this->OnRawFtraceDataAvailable(cpu);
  weak_this->task_runner_->PostDelayedTask(
      std::bind(&FtraceController::PeriodicDrainCPU, weak_this, cpu),
      has_more ? 0 : kDrainPeriodMs);
}

void FtraceController::Start() {
  if (listening_for_raw_trace_data_) {
    PERFETTO_DLOG("FtraceController is already started.");
    return;
  }
  listening_for_raw_trace_data_ = true;
  ftrace_procfs_->ClearTrace();
  ftrace_procfs_->EnableTracing();
  for (size_t cpu = 0; cpu < ftrace_procfs_->NumberOfCpus(); cpu++) {
    base::WeakPtr<FtraceController> weak_this = weak_factory_.GetWeakPtr();
    task_runner_->PostDelayedTask(
        std::bind(&FtraceController::PeriodicDrainCPU, weak_this, cpu),
        kDrainPeriodMs);
  }
}

void FtraceController::Stop() {
  if (!listening_for_raw_trace_data_) {
    PERFETTO_DLOG("FtraceController is already stopped.");
    return;
  }
  listening_for_raw_trace_data_ = false;
  size_t total_events = 0;
  PERFETTO_LOG("Ftrace done. Counting total events:");
  for (size_t cpu = 0; cpu < ftrace_procfs_->NumberOfCpus(); cpu++) {
    CpuReader* reader = GetCpuReader(cpu);
    PERFETTO_LOG("  Cpu %zu: %zu", cpu, reader->total_num_events());
    total_events += reader->total_num_events();
  }
  ftrace_procfs_->DisableTracing();
  PERFETTO_ILOG("Total: %zu events, %zu bundles", total_events, num_bundles_);
}

bool FtraceController::OnRawFtraceDataAvailable(size_t cpu) {
  CpuReader* reader = GetCpuReader(cpu);
  using BundleHandle =
      protozero::ProtoZeroMessageHandle<protos::pbzero::FtraceEventBundle>;
  std::array<const EventFilter*, kMaxSinks> filters{};
  std::array<BundleHandle, kMaxSinks> bundles{};
  size_t sink_count = sinks_.size();
  size_t i = 0;
  for (FtraceSink* sink : sinks_) {
    filters[i] = sink->get_event_filter();
    bundles[i++] = sink->GetBundleForCpu(cpu);
    num_bundles_++;
  }
  bool res = reader->Drain(filters, bundles);
  i = 0;
  for (FtraceSink* sink : sinks_)
    sink->OnBundleComplete(cpu, std::move(bundles[i++]));
  PERFETTO_DCHECK(sinks_.size() == sink_count);
  return res;
}

CpuReader* FtraceController::GetCpuReader(size_t cpu) {
  PERFETTO_CHECK(cpu < ftrace_procfs_->NumberOfCpus());
  if (!readers_.count(cpu)) {
    readers_.emplace(
        cpu, std::unique_ptr<CpuReader>(new CpuReader(
                 table_.get(), cpu, ftrace_procfs_->OpenPipeForCpu(cpu))));
  }
  return readers_.at(cpu).get();
}

std::unique_ptr<FtraceSink> FtraceController::CreateSink(
    FtraceConfig config,
    FtraceSink::Delegate* delegate) {
  PERFETTO_DCHECK_THREAD(thread_checker_);
  if (sinks_.size() >= kMaxSinks)
    return nullptr;
  auto controller_weak = weak_factory_.GetWeakPtr();
  auto filter = std::unique_ptr<EventFilter>(
      new EventFilter(*table_.get(), config.events()));
  auto sink = std::unique_ptr<FtraceSink>(
      new FtraceSink(std::move(controller_weak), std::move(config),
                     std::move(filter), delegate));
  Register(sink.get());
  return sink;
}

void FtraceController::Register(FtraceSink* sink) {
  PERFETTO_DCHECK_THREAD(thread_checker_);
  auto it_and_inserted = sinks_.insert(sink);
  PERFETTO_DCHECK(it_and_inserted.second);
  if (sink->config().WantsAtrace()) {
    StartAtrace(sink->config());
  }
  for (const std::string& name : sink->enabled_events())
    RegisterForEvent(name);
  if (sinks_.size() == 1)
    Start();
}

void FtraceController::RegisterForEvent(const std::string& name) {
  PERFETTO_DCHECK_THREAD(thread_checker_);
  const ProtoTranslationTable::Event* event = table_->GetEventByName(name);
  if (!event) {
    PERFETTO_DLOG("Can't enable %s, event not known", name.c_str());
    return;
  }
  size_t& count = enabled_count_.at(event->ftrace_event_id);
  if (count == 0)
    ftrace_procfs_->EnableEvent(event->group, event->name);
  count += 1;
}

void FtraceController::UnregisterForEvent(const std::string& name) {
  PERFETTO_DCHECK_THREAD(thread_checker_);
  const ProtoTranslationTable::Event* event = table_->GetEventByName(name);
  if (!event)
    return;
  size_t& count = enabled_count_.at(event->ftrace_event_id);
  PERFETTO_CHECK(count > 0);
  if (--count == 0)
    ftrace_procfs_->DisableEvent(event->group, event->name);
}

void FtraceController::Unregister(FtraceSink* sink) {
  PERFETTO_DCHECK_THREAD(thread_checker_);
  size_t removed = sinks_.erase(sink);
  PERFETTO_DCHECK(removed == 1);
  for (const std::string& name : sink->enabled_events())
    UnregisterForEvent(name);
  if (sink->config().WantsAtrace())
    StopAtrace();
  if (sinks_.size() == 0)
    Stop();
}

void FtraceController::StartAtrace(const FtraceConfig& config) {
#if defined(ANDROID)
  PERFETTO_CHECK(atrace_running_ == false);
  atrace_running_ = true;
  PERFETTO_DLOG("Start atrace...");
  std::vector<std::string> args;
  args.push_back("--async_start");
  for (const auto& category : config.atrace_categories())
    args.push_back(category);
  if (!config.atrace_apps().empty()) {
    args.push_back("-a");
    for (const auto& app : config.atrace_apps())
      args.push_back(app);
  }

  PERFETTO_CHECK(RunAtrace(args));
  PERFETTO_DLOG("...done");
#endif  // defined(ANDROID)
}

void FtraceController::StopAtrace() {
#if defined(ANDROID)
  PERFETTO_CHECK(atrace_running_ == true);
  atrace_running_ = false;
  PERFETTO_DLOG("Stop atrace...");
  PERFETTO_CHECK(RunAtrace(std::vector<std::string>({"--async_stop"})));
  PERFETTO_DLOG("...done");
#endif  // defined(ANDROID)
}

FtraceSink::FtraceSink(base::WeakPtr<FtraceController> controller_weak,
                       FtraceConfig config,
                       std::unique_ptr<EventFilter> filter,
                       Delegate* delegate)
    : controller_weak_(std::move(controller_weak)),
      config_(std::move(config)),
      filter_(std::move(filter)),
      delegate_(delegate){};

FtraceSink::~FtraceSink() {
  if (controller_weak_)
    controller_weak_->Unregister(this);
};

const std::set<std::string>& FtraceSink::enabled_events() {
  return filter_->enabled_names();
}

FtraceConfig::FtraceConfig() = default;
FtraceConfig::FtraceConfig(std::set<std::string> events)
    : ftrace_events_(std::move(events)) {}
FtraceConfig::~FtraceConfig() = default;

void FtraceConfig::AddEvent(const std::string& event) {
  ftrace_events_.insert(event);
}

void FtraceConfig::AddAtraceApp(const std::string& app) {
  // You implicitly need the print ftrace event if you
  // are using atrace.
  AddEvent("print");
  atrace_apps_.insert(app);
}

void FtraceConfig::AddAtraceCategory(const std::string& category) {
  // You implicitly need the print ftrace event if you
  // are using atrace.
  AddEvent("print");
  atrace_categories_.insert(category);
}

bool FtraceConfig::WantsAtrace() const {
  return !atrace_categories_.empty() || !atrace_apps_.empty();
}

}  // namespace perfetto

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

#include <stdio.h>

#include "base/logging.h"
#include "base/unix_task_runner.h"
#include "demo/common.h"
#include "ftrace_reader/ftrace_controller.h"
#include "tracing/core/data_source_config.h"
#include "tracing/core/data_source_descriptor.h"
#include "tracing/core/producer.h"
#include "tracing/core/trace_config.h"
#include "tracing/core/trace_packet.h"
#include "tracing/core/trace_writer.h"
#include "tracing/ipc/producer_ipc_client.h"

#include "protos/ftrace/ftrace_event_bundle.pbzero.h"
#include "protos/trace_packet.pbzero.h"

namespace perfetto {

namespace {

bool StartsWith(const std::string& str, const std::string& prefix) {
  return str.compare(0, prefix.length(), prefix) == 0;
}

std::string RemovePrefix(const std::string& str, const std::string& prefix) {
  if (!StartsWith(str, prefix))
    return str;
  return str.substr(prefix.length());
}

using BundleHandle =
    protozero::ProtoZeroMessageHandle<protos::pbzero::FtraceEventBundle>;

class SinkDelegate : public FtraceSink::Delegate {
 public:
  SinkDelegate(std::unique_ptr<TraceWriter> writer);
  ~SinkDelegate() override;

  // FtraceDelegateImpl
  BundleHandle GetBundleForCpu(size_t cpu) override;
  void OnBundleComplete(size_t cpu, BundleHandle bundle) override;

  void sink(std::unique_ptr<FtraceSink> sink) {
    sink_ = std::move(sink);
  }

 private:
  std::unique_ptr<FtraceSink> sink_ = nullptr;
  TraceWriter::TracePacketHandle trace_packet_;
  std::unique_ptr<TraceWriter> writer_;
};

SinkDelegate::SinkDelegate(
    std::unique_ptr<TraceWriter> writer) :
    writer_(std::move(writer)) {}

SinkDelegate::~SinkDelegate() = default;

BundleHandle SinkDelegate::GetBundleForCpu(size_t cpu) {
  trace_packet_ = writer_->NewTracePacket();
  return BundleHandle(trace_packet_->set_ftrace_events());
}

void SinkDelegate::OnBundleComplete(size_t cpu, BundleHandle bundle) {
  trace_packet_.Finalize();
}

class FtraceProducer : public Producer {
 public:
  ~FtraceProducer() override;

  // Producer Impl:
  void OnConnect() override;
  void OnDisconnect() override;
  void CreateDataSourceInstance(DataSourceInstanceID,
                                const DataSourceConfig&) override;
  void TearDownDataSourceInstance(DataSourceInstanceID) override;

  // Our Impl
  void Run();

 private:
  std::unique_ptr<Service::ProducerEndpoint> endpoint_ = nullptr;
  std::unique_ptr<FtraceController> ftrace_ = nullptr;
  DataSourceID data_source_id_;
  std::map<DataSourceInstanceID, std::unique_ptr<SinkDelegate>> delegates_;
};

FtraceProducer::~FtraceProducer() = default;

void FtraceProducer::OnConnect() {
  PERFETTO_DLOG("Connected to the service\n");

  DataSourceDescriptor descriptor;
  // TODO(hjd): Update name.
  descriptor.set_name("perfetto.test.data_source");
  endpoint_->RegisterDataSource(
      descriptor, [this](DataSourceID id) { data_source_id_ = id; });
}

void FtraceProducer::OnDisconnect() {
  PERFETTO_DLOG("Disconnected from tracing service");
  exit(1);
}

void FtraceProducer::CreateDataSourceInstance(
    DataSourceInstanceID id,
    const DataSourceConfig& source_config) {
  PERFETTO_ILOG("Source start (id=%" PRIu64 ", target_buf=%" PRIu32 ")", id, source_config.target_buffer());

  const std::string& categories = source_config.trace_category_filters();
  FtraceConfig config;
  size_t last = 0;
  for (size_t i = 0; i <= categories.size(); i++) {
    if (i == categories.size() || categories[i] == ',') {
      std::string category = categories.substr(last, i - last).c_str();
      last = i + 1;
      if (!category.size())
        continue;
      if (StartsWith(category, "atrace_cat.")) {
        config.AddAtraceCategory(RemovePrefix(category, "atrace_cat."));
      } else if (StartsWith(category, "atrace_app.")) {
        config.AddAtraceApp(RemovePrefix(category, "atrace_app."));
      } else {
        config.AddEvent(category);
      }
    }
  }
  //auto trace_writer = endpoint_->CreateTraceWriter(source_config.target_buffer());
  // TODO(hjd): Remove this terrible hack:
  auto trace_writer = endpoint_->CreateTraceWriter(id-1);
  auto delegate = std::unique_ptr<SinkDelegate>(new SinkDelegate(std::move(trace_writer)));
  auto sink = ftrace_->CreateSink(config, delegate.get());
  PERFETTO_CHECK(sink);
  delegate->sink(std::move(sink));
  delegates_.emplace(id, std::move(delegate));
}

void FtraceProducer::TearDownDataSourceInstance(DataSourceInstanceID id) {
  PERFETTO_ILOG("Source stop (id=%" PRIu64 ")", id);
  delegates_.erase(id);
}

void FtraceProducer::Run() {
  SetUidAndGid("shell");

  ftrace_ = FtraceController::Create(g_task_runner);
  endpoint_ =
      ProducerIPCClient::Connect(kProducerSocketName, this, g_task_runner);
  ftrace_->DisableAllEvents();
  ftrace_->ClearTrace();
  ftrace_->WriteTraceMarker("Hello, world!");
  g_task_runner->Run();
}

}  // namespace.

int ProducerMain(int argc, char** argv) {
  SetComm("perfetto-producer");
  perfetto::FtraceProducer producer;
  producer.Run();
  return 0;
}

}  // namespace perfetto

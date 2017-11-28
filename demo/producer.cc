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
#include "tracing/core/data_source_config.h"
#include "tracing/core/data_source_descriptor.h"
#include "tracing/core/producer.h"
#include "tracing/core/trace_config.h"
#include "tracing/core/trace_packet.h"
#include "tracing/core/trace_writer.h"
#include "tracing/ipc/producer_ipc_client.h"
#include "ftrace_reader/ftrace_controller.h"

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

class FtraceProducer : public Producer, FtraceSink::Delegate {
 public:
  ~FtraceProducer() override;

  // Producer Impl:
  void OnConnect() override;
  void OnDisconnect() override;
  void CreateDataSourceInstance(DataSourceInstanceID,
                                const DataSourceConfig&) override;
  void TearDownDataSourceInstance(DataSourceInstanceID) override;

  // FtraceDelegateImpl
  BundleHandle GetBundleForCpu(size_t cpu) override;
  void OnBundleComplete(size_t cpu, BundleHandle bundle) override;

  // Our Impl
  void Run();

 private:
  std::unique_ptr<Service::ProducerEndpoint> endpoint_ = nullptr;
  std::unique_ptr<FtraceController> ftrace_ = nullptr;
  std::unique_ptr<TraceWriter> trace_writer_ = nullptr;
  TraceWriter::TracePacketHandle trace_packet_;
  DataSourceID data_source_id_;
  std::map<DataSourceInstanceID, std::unique_ptr<FtraceSink>> sinks_;
};

FtraceProducer::~FtraceProducer() = default;

void FtraceProducer::OnConnect() {
  PERFETTO_DLOG("Connected to the service\n");

  trace_writer_ = endpoint_->CreateTraceWriter();

  DataSourceDescriptor descriptor;
  // TODO(hjd): Update name.
  descriptor.name = "perfetto.test.data_source";
  endpoint_->RegisterDataSource(descriptor, [this](DataSourceID id) {
    data_source_id_ = id;
  });
}

void FtraceProducer::OnDisconnect() {
  PERFETTO_DLOG("Disconnected from tracing service");
  exit(1);
}

void FtraceProducer::CreateDataSourceInstance(
    DataSourceInstanceID id,
    const DataSourceConfig& source_config) {

  PERFETTO_DLOG("Service asked to start data source\n");

  const std::string& categories = source_config.trace_category_filters;
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
  auto sink = ftrace_->CreateSink(config, this);
  PERFETTO_CHECK(sink);
  sinks_.emplace(id, std::move(sink));
}

void FtraceProducer::TearDownDataSourceInstance(DataSourceInstanceID id) {
  PERFETTO_DLOG(
      "The tracing service requested us to shutdown the data source %" PRIu64,
      id);
}

BundleHandle FtraceProducer::GetBundleForCpu(size_t cpu) {
  trace_packet_ = trace_writer_->NewTracePacket();
  trace_packet_->set_test("Foo!");
  return BundleHandle(trace_packet_->set_ftrace_events());
}

void FtraceProducer::OnBundleComplete(size_t cpu, BundleHandle bundle) {
  trace_packet_.Finalize();
}

void FtraceProducer::Run() {
  // Shell has recently lost access to tracingfs. http://b/69839129.
  // SetUidAndGid("shell");

  base::UnixTaskRunner runner;
  ftrace_ = FtraceController::Create(&runner);
  endpoint_ = ProducerIPCClient::Connect(kProducerSocketName, this, &runner);
  ftrace_->DisableAllEvents();
  ftrace_->ClearTrace();
  ftrace_->WriteTraceMarker("Hello, world!");
  ftrace_->Start();
  runner.Run();
  ftrace_->Stop();
}

}  // namespace.
}  // namespace perfetto

int main(int argc, char** argv) {
  perfetto::FtraceProducer producer;
  producer.Run();
  return 0;
}

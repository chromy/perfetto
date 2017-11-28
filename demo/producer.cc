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

#include "protos/trace_packet.pbzero.h"

namespace perfetto {

namespace {

class TestProducer : public Producer {
 public:
  void OnConnect() override {
    if (on_connect)
      on_connect();
  }

  void OnDisconnect() override {
    PERFETTO_DLOG("Disconnected from tracing service");
    exit(1);
  }

  void CreateDataSourceInstance(DataSourceInstanceID dsid,
                                const DataSourceConfig& cfg) override {
    if (on_create_ds)
      on_create_ds(cfg);
  }

  void TearDownDataSourceInstance(DataSourceInstanceID instance_id) override {
    PERFETTO_DLOG(
        "The tracing service requested us to shutdown the data source %" PRIu64,
        instance_id);
  }

  std::function<void()> on_connect;
  std::function<void(const DataSourceConfig&)> on_create_ds;
};

void ProducerMain() {
  base::UnixTaskRunner task_runner;
  TestProducer producer;
  std::unique_ptr<Service::ProducerEndpoint> endpoint =
      ProducerIPCClient::Connect(kProducerSocketName, &producer, &task_runner);

  SetUidAndGid("shell");

  DataSourceDescriptor descriptor;
  descriptor.name = "perfetto.test.data_source";

  auto on_register = [](DataSourceID id) {
    printf("Service acked RegisterDataSource() with ID %" PRIu64 "\n", id);
    PERFETTO_DCHECK(id);
  };

  producer.on_connect = [&endpoint, &descriptor, &on_register] {
    printf("Connected to the service\n");
    endpoint->RegisterDataSource(descriptor, on_register);
  };

  producer.on_create_ds = [&endpoint](const DataSourceConfig& cfg) {
    printf("Service asked to start data source\n");

    auto trace_writer1 = endpoint->CreateTraceWriter();
    auto trace_writer2 = endpoint->CreateTraceWriter();
    for (int j = 0; j < 240; j++) {
      auto event = trace_writer1->NewTracePacket();
      char content[64];
      sprintf(content, "Stream 1 - %3d .................", j);
      event->set_test(content);
      event = trace_writer2->NewTracePacket();
      sprintf(content, "Stream 2 - %3d ++++++++++++++++++++++++++++++++++++",
              j);
      event->set_test(content);
    }
  };

  task_runner.Run();
}

}  // namespace.
}  // namespace perfetto

int main(int argc, char** argv) {
  perfetto::ProducerMain();
  return 0;
}

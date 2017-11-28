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

#include <inttypes.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

#include "base/logging.h"
#include "base/unix_task_runner.h"
#include "demo/common.h"
#include "tracing/core/consumer.h"
#include "tracing/core/data_source_config.h"
#include "tracing/core/data_source_descriptor.h"
#include "tracing/core/service.h"
#include "tracing/core/trace_config.h"
#include "tracing/core/trace_packet.h"
#include "tracing/core/trace_writer.h"
#include "tracing/ipc/consumer_ipc_client.h"
#include "tracing/src/core/service_impl.h"

#include "protos/trace_packet.pb.h"

namespace perfetto {
namespace {

class TestConsumer : public Consumer {
 public:
  void OnConnect() override {
    PERFETTO_DLOG("Connected as Consumer");
    if (on_connect)
      on_connect();
  }

  void OnDisconnect() override {
    PERFETTO_DLOG("Disconnected from tracing service");
    exit(1);
  }

  void OnTraceData(const std::vector<TracePacket>& trace_packets,
                   bool has_more) override {
    if (on_trace_data)
      on_trace_data(trace_packets, has_more);
  }

  std::function<void()> on_connect;
  std::function<void(const std::vector<TracePacket>&, bool)> on_trace_data;
};

void ConsumerMain() {
  base::UnixTaskRunner task_runner;
  TestConsumer consumer;
  std::unique_ptr<Service::ConsumerEndpoint> endpoint =
      ConsumerIPCClient::Connect(kConsumerSocketName, &consumer, &task_runner);

  TraceConfig trace_config;
  trace_config.buffers.emplace_back();
  trace_config.buffers.back().size_kb = 1024;
  trace_config.data_sources.emplace_back();
  trace_config.data_sources.back().config.name = "perfetto.test.data_source";
  trace_config.data_sources.back().config.target_buffer = 0;
  trace_config.data_sources.back().config.trace_category_filters = "aa,bb";

  consumer.on_connect = [&endpoint, &trace_config] {
    printf("Connected, sending EnableTracing() request\n");
    endpoint->EnableTracing(trace_config);
  };

  task_runner.PostDelayedTask(
      [&endpoint] {
        printf("Sending DisableTracing() + ReadBuffers() request\n");
        endpoint->DisableTracing();
        endpoint->ReadBuffers();
      },
      2000);

  consumer.on_trace_data = [](const std::vector<TracePacket>& trace_packets,
                              bool has_more) {
    printf("OnTraceData()\n");
    for (const TracePacket& const_packet : trace_packets) {
      TracePacket& packet = const_cast<TracePacket&>(const_packet);
      bool decoded = packet.Decode();
      printf(" %d %s\n", decoded,
             decoded ? packet->test().c_str() : "[Decode fail]");
    }
    if (!has_more)
      exit(0);
  };

  task_runner.Run();
}

}  // namespace.
}  // namespace perfetto

int main(int argc, char** argv) {
  perfetto::ConsumerMain();
  return 0;
}

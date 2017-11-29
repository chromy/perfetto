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

#include <fcntl.h>
#include <inttypes.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#include "base/logging.h"
#include "base/unix_task_runner.h"
#include "demo/common.h"
#include "protozero/proto_utils.h"
#include "tracing/core/consumer.h"
#include "tracing/core/data_source_config.h"
#include "tracing/core/data_source_descriptor.h"
#include "tracing/core/service.h"
#include "tracing/core/trace_config.h"
#include "tracing/core/trace_packet.h"
#include "tracing/core/trace_writer.h"
#include "tracing/ipc/consumer_ipc_client.h"
#include "tracing/src/core/service_impl.h"

#include "protos/ftrace/ftrace_event.pb.h"
#include "protos/ftrace/ftrace_event_bundle.pb.h"
#include "protos/ftrace/print.pb.h"
#include "protos/ftrace/sched_switch.pb.h"
#include "protos/trace.pb.h"
#include "protos/trace_packet.pb.h"

namespace perfetto {
namespace {

using protos::FtraceEventBundle;
using protos::FtraceEvent;
using protos::SchedSwitchFtraceEvent;
using protos::PrintFtraceEvent;
using protozero::proto_utils::WriteVarInt;
using protozero::proto_utils::MakeTagLengthDelimited;

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

}  // namespace.

int ConsumerMain(int argc, char** argv) {
  base::UnixTaskRunner task_runner;
  TestConsumer consumer;
  std::unique_ptr<Service::ConsumerEndpoint> endpoint =
      ConsumerIPCClient::Connect(kConsumerSocketName, &consumer, &task_runner);

  TraceConfig trace_config;

  TraceConfig::BufferConfig buf_config(trace_config.add_buffers());
  buf_config.set_size_kb(1024);

  TraceConfig::DataSource data_source = trace_config.add_data_sources();
  DataSourceConfig ds_config = data_source.mutable_config();
  ds_config.set_name("perfetto.test.data_source");
  ds_config.set_target_buffer(0);
  ds_config.set_trace_category_filters("print,sched_switch,atrace_cat.sched");

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

  printf("Writing trace output to /data/local/tmp/trace.output\n");
  unlink("/data/local/tmp/trace.protobuf");
  int fd = open("/data/local/tmp/trace.protobuf", O_WRONLY | O_CREAT, 0644);
  PERFETTO_CHECK(fd > 0);

  consumer.on_trace_data = [&fd](const std::vector<TracePacket>& trace_packets,
                                 bool has_more) {
    printf("OnTraceData() num packets = %zu\n", trace_packets.size());
    for (const TracePacket& const_packet : trace_packets) {
      TracePacket& packet = const_cast<TracePacket&>(const_packet);
      bool decoded = packet.Decode();
      printf(" %d %s\n", decoded,
             decoded ? packet->test().c_str() : "[Decode fail]");
      if (!decoded || !packet->has_ftrace_events())
        continue;

      uint8_t buffer[1024];
      uint32_t field_id = 1;
      uint32_t tag = MakeTagLengthDelimited(field_id);
      uint8_t* pos = buffer;
      pos = WriteVarInt(tag, pos);
      pos = WriteVarInt(static_cast<uint32_t>(packet.size()), pos);
      write(fd, buffer, pos - buffer);
      write(fd, packet.start(), packet.size());
    }

    if (!has_more) {
      close(fd);
      exit(0);
    }
  };

  task_runner.Run();

  return 0;
}

}  // namespace perfetto

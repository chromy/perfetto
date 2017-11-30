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
  SetComm("perfetto-producer");
  TestConsumer consumer;
  std::unique_ptr<Service::ConsumerEndpoint> endpoint =
      ConsumerIPCClient::Connect(kConsumerSocketName, &consumer, g_task_runner);

  TraceConfig trace_config;

  TraceConfig::BufferConfig buf_config(trace_config.add_buffers());
  buf_config.set_size_kb(1024);

  TraceConfig::DataSource data_source = trace_config.add_data_sources();
  DataSourceConfig ds_config = data_source.mutable_config();
  ds_config.set_name("perfetto.test.data_source");
  ds_config.set_target_buffer(0);
  ds_config.set_trace_category_filters("print,sched_switch,atrace_cat.sched");

  consumer.on_connect = [&endpoint, &trace_config] {
    PERFETTO_LOG("Connected, sending EnableTracing() request");
    endpoint->EnableTracing(trace_config);
  };

  g_task_runner->PostDelayedTask(
      [&endpoint] {
        PERFETTO_LOG("Sending DisableTracing() + ReadBuffers() request");
        endpoint->DisableTracing();
        endpoint->ReadBuffers();
      },
      5000);

  static const char kTraceFile[] = "/data/local/tmp/trace.protobuf";
  PERFETTO_LOG("Writing trace output to %s", kTraceFile);
  unlink(kTraceFile);
  int fd = open(kTraceFile, O_WRONLY | O_CREAT, 0644);
  PERFETTO_CHECK(fd > 0);
  size_t tot_packets = 0;
  size_t tot_events = 0;
  size_t tot_size = 0;

  consumer.on_trace_data = [&](const std::vector<TracePacket>& trace_packets,
                               bool has_more) {
    PERFETTO_DLOG("OnTraceData() num packets = %zu", trace_packets.size());
    for (const TracePacket& const_packet : trace_packets) {
      tot_packets++;
      TracePacket& packet = const_cast<TracePacket&>(const_packet);
      bool decoded = packet.Decode();
      if (!decoded || !packet->has_ftrace_events())
        continue;
      tot_events += packet->ftrace_events().event_size();

      uint8_t preamble[8];
      uint8_t* pos = preamble;
      pos = WriteVarInt(MakeTagLengthDelimited(1 /* field_id */), pos);
      pos = WriteVarInt(static_cast<uint32_t>(packet.size()), pos);
      write(fd, preamble, pos - preamble);
      write(fd, packet.start(), packet.size());
      tot_size += packet.size();
    }

    if (!has_more) {
      PERFETTO_ILOG("Writing trace: %zu packets, %zu events, %zu kB %s",
                    tot_packets, tot_events, tot_size / 1024, "");
      close(fd);
      exit(0);
    }
  };

  g_task_runner->Run();

  return 0;
}

}  // namespace perfetto

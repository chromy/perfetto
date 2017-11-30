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

#include <algorithm>
#include <fstream>
#include <iostream>
#include <istream>
#include <memory>
#include <map>
#include <ostream>
#include <sstream>
#include <string>
#include <utility>

#include <google/protobuf/io/zero_copy_stream_impl.h>
#include "google/protobuf/text_format.h"

#include "base/logging.h"
#include "protos/trace.pb.h"
#include "protos/trace_packet.pb.h"

namespace perfetto {
namespace {

using protos::Trace;
using protos::TracePacket;
using protos::FtraceEventBundle;
using protos::FtraceEvent;
using protos::SchedSwitchFtraceEvent;
using protos::PrintFtraceEvent;
using google::protobuf::TextFormat;
using google::protobuf::io::OstreamOutputStream;

const char* GetFlag(int32_t state) {
  state &= 511;
  if (state & 1) return "S";
  if (state & 2) return "D";
  if (state & 4) return "T";
  if (state & 8) return "t";
  if (state & 16) return "Z";
  if (state & 32) return "X";
  if (state & 64) return "x";
  if (state & 128) return "W";
  return "R";
}

uint64_t TimestampToSeconds(uint64_t timestamp) {
  return timestamp / 1000000000;
}

uint64_t TimestampToMicroseconds(uint64_t timestamp) {
  return (timestamp / 1000) % 1000000;
}

std::string FormatSchedSwitch(uint64_t timestamp,
                       uint64_t cpu,
                       const SchedSwitchFtraceEvent& sched_switch) {
  char line[2048];
  uint64_t seconds = TimestampToSeconds(timestamp);
  uint64_t useconds = TimestampToMicroseconds(timestamp);
  sprintf(line, "<idle>-0     (-----) [%03" PRIu64 "] d..3 %" PRIu64 ".%.6" PRIu64
         ": sched_switch: prev_comm=%s "
         "prev_pid=%d prev_prio=%d prev_state=%s ==> next_comm=%s next_pid=%d "
         "next_prio=%d\\n",
         cpu, seconds, useconds, sched_switch.prev_comm().c_str(),
         sched_switch.prev_pid(), sched_switch.prev_prio(),
         GetFlag(sched_switch.prev_state()), sched_switch.next_comm().c_str(),
         sched_switch.next_pid(), sched_switch.next_prio());
  return std::string(line);
}

std::string FormatPrint(uint64_t timestamp,
                       uint64_t cpu,
                       const PrintFtraceEvent& print) {
  char line[2048];
  uint64_t seconds = TimestampToSeconds(timestamp);
  uint64_t useconds = TimestampToMicroseconds(timestamp);
  std::string msg = print.buf();
  msg.erase(std::remove(msg.begin(), msg.end(), '\n'), msg.end());
  sprintf(line, "<idle>-0     (-----) [%03" PRIu64 "] d..3 %" PRIu64 ".%.6" PRIu64
         ": tracing_mark_write: %s\\n",
         cpu, seconds, useconds, msg.c_str());
  return std::string(line);
}

int ProtoToText(std::istream* input, std::ostream* output, bool systrace) {
  Trace trace;
  if (!trace.ParseFromIstream(input)) {
    PERFETTO_DLOG("Could not parse input.");
    return 1;
  }
  if (!systrace) {
    OstreamOutputStream zero_copy_output(output);
    TextFormat::Print(trace, &zero_copy_output);
    return 0;
  }

  const std::string header = R"({
  "traceEvents": [],
)";

  const std::string ftrace_start =
      ""
      "  \"systemTraceEvents\": \""
      "# tracer: nop\\n"
      "#\\n"
      "# entries-in-buffer/entries-written: 30624/30624   #P:4\\n"
      "#\\n"
      "#                                      _-----=> irqs-off\\n"
      "#                                     / _----=> need-resched\\n"
      "#                                    | / _---=> hardirq/softirq\\n"
      "#                                    || / _--=> preempt-depth\\n"
      "#                                    ||| /     delay\\n"
      "#           TASK-PID    TGID   CPU#  ||||    TIMESTAMP  FUNCTION\\n"
      "#              | |        |      |   ||||       |         |\\n";

  const std::string footer = R"(\n",
  "controllerTraceDataKey": "systraceController"
})";
  printf("%s", header.c_str());
  printf("%s", ftrace_start.c_str());
  std::multimap<uint64_t, std::string> sorted;

  for (const TracePacket& packet : trace.packet()) {
    if (!packet.has_ftrace_events())
      continue;

    const FtraceEventBundle& bundle = packet.ftrace_events();
    for (const FtraceEvent& event : bundle.event()) {
      if (event.has_sched_switch()) {
        const SchedSwitchFtraceEvent& sched_switch = event.sched_switch();
        sorted.emplace(
            event.timestamp(),
            FormatSchedSwitch(event.timestamp(), bundle.cpu(), sched_switch));
      } else if (event.has_print()) {
        const PrintFtraceEvent& print = event.print();
        sorted.emplace(
            event.timestamp(),
            FormatPrint(event.timestamp(), bundle.cpu(), print));
      }
    }
  }

  for (auto it = sorted.begin(); it != sorted.end(); it++)
    printf("%s", it->second.c_str());

  printf("%s", footer.c_str());

  return 0;
}

}  // namespace
}  // namespace perfetto

namespace {

int Usage(int argc, char** argv) {
  printf("Usage: %s [systrace|text]\n", argv[0]);
  return 1;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc != 2)
    return Usage(argc, argv);

  std::string format(argv[1]);

  if (format != "systrace" && format != "text")
    return Usage(argc, argv);

  bool systrace = format == "systrace";

  return perfetto::ProtoToText(&std::cin, &std::cout, systrace);
}

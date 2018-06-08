/*
 * Copyright (C) 2018 The Android Open Source Project
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

#include <emscripten/emscripten.h>
#include <map>
#include <string>

#include "perfetto/base/logging.h"
#include "perfetto/trace_processor/sched.pb.h"
#include "src/trace_processor/emscripten_task_runner.h"
#include "src/trace_processor/trace_database.h"

namespace perfetto {
namespace trace_processor {

// ReadTrace(): reads a portion of the trace file. Ca
// Invoked by the C++ code in the trace processor to ask the embedder (e.g. the
// JS code for the case of the UI) to get read a chunk of the trace file.
// Args:
//   offset: the start offset (in bytes) in the trace file to read.
//   len: maximum size of the buffered returned.
// Returns:
//   The embedder is supposed to asynchronously call ReadComplete(), passing
//   back the offset, together with the actual buffer.
using ReadTraceFunction = uint32_t (*)(uint32_t /*offset*/,
                                       uint32_t /*len*/,
                                       uint8_t* /*dst*/);

namespace {

EmscriptenTaskRunner* g_task_runner;
TraceDatabase* g_trace_database;
ReadTraceFunction g_read_trace;

}

// +---------------------------------------------------------------------------+
// | Exported functions called by the JS/TS running in the worker.             |
// +---------------------------------------------------------------------------+
extern "C" {
void EMSCRIPTEN_KEEPALIVE Initialize(ReadTraceFunction);
void Initialize(ReadTraceFunction read_trace_function) {
  PERFETTO_ILOG("Initializing WASM bridge");
  g_task_runner = new EmscriptenTaskRunner();
  g_trace_database = new TraceDatabase(g_task_runner);
  g_read_trace = read_trace_function;
  //g_trace_database->LoadTrace(reader);
}

}  // extern "C"

}  // namespace trace_processor
}  // namespace perfetto

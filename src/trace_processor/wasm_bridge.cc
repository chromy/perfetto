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

using RequestID = uint32_t;

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

// Called asynchronously (i.e. in a separate task) by the C++ code inside the
// trace processor to return data for a RPC method call.
// The function is generic and thankfully we need just one for all methods
// because the output is always a protobuf buffer.
// Args:
//  RequestID: the ID passed by the embedder when invoking the RPC method (e.g.,
//             the first argument passed to sched_getSchedEvents()).
using ReplyFunction = void (*)(RequestID,
                               bool success,
                               const char* /*proto_reply_data*/,
                               uint32_t /*len*/);

namespace {

EmscriptenTaskRunner* g_task_runner;
TraceDatabase* g_trace_database;
ReadTraceFunction g_read_trace;
ReplyFunction g_reply;

// Implements the BlobReader interface passed to the trace processor C++
// classes. It simply routes the requests to the embedder (e.g. JS/TS).
class BlobReaderImpl : public BlobReader {
 public:
  ~BlobReaderImpl() override = default;

  uint32_t Read(uint64_t offset, uint32_t len, uint8_t* dst) override {
    return g_read_trace(static_cast<uint32_t>(offset), len, dst);
  }
};

BlobReaderImpl* blob_reader() {
  static BlobReaderImpl* instance = new BlobReaderImpl();
  return instance;
}

}

// +---------------------------------------------------------------------------+
// | Exported functions called by the JS/TS running in the worker.             |
// +---------------------------------------------------------------------------+
extern "C" {
void EMSCRIPTEN_KEEPALIVE Initialize(ReadTraceFunction, ReplyFunction);
void Initialize(ReadTraceFunction read_trace_function, ReplyFunction reply_function) {
  PERFETTO_ILOG("Initializing WASM bridge");
  g_task_runner = new EmscriptenTaskRunner();
  g_trace_database = new TraceDatabase(g_task_runner);
  g_read_trace = read_trace_function;
  g_reply = reply_function;
  g_trace_database->LoadTrace(blob_reader(), []() {
    PERFETTO_ILOG("Trace Loaded");
  });
}

void EMSCRIPTEN_KEEPALIVE ExecuteQuery();
void ExecuteQuery() {
  PERFETTO_ILOG("ExecuteQuery");
}

}  // extern "C"

}  // namespace trace_processor
}  // namespace perfetto

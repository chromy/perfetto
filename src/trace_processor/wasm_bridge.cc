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

namespace perfetto {
namespace trace_processor {

namespace {

EmscriptenTaskRunner* g_task_runner;

}

// +---------------------------------------------------------------------------+
// | Exported functions called by the JS/TS running in the worker.             |
// +---------------------------------------------------------------------------+
extern "C" {
void EMSCRIPTEN_KEEPALIVE main();
void main() {
  PERFETTO_ILOG("Initializing WASM bridge\n");
  g_task_runner = new EmscriptenTaskRunner();
  // TODO(hjd): Patch.
}

}  // extern "C"

}  // namespace trace_processor
}  // namespace perfetto

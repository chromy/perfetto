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

#include <unistd.h>

#include "base/logging.h"
#include "base/unix_task_runner.h"
#include "demo/common.h"
#include "tracing/ipc/service_ipc_host.h"

namespace perfetto {

int ServiceMain(int argc, char** argv) {
  unlink(perfetto::kProducerSocketName);
  unlink(perfetto::kConsumerSocketName);
  std::unique_ptr<perfetto::ServiceIPCHost> host =
      perfetto::ServiceIPCHost::CreateInstance(g_task_runner);
  host->Start(perfetto::kProducerSocketName, perfetto::kConsumerSocketName);
  g_task_runner->PostTask([] { PERFETTO_ILOG("Service started\n"); });

  SetUidAndGid("nobody");

  g_task_runner->Run();
  return 0;
}

}  // namespace perfetto

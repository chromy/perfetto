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

#ifndef DEMO_COMMON_H_
#define DEMO_COMMON_H_

#include "base/build_config.h"

namespace perfetto {

namespace base {
class UnixTaskRunner;
}  // namespace base

#if BUILDFLAG(OS_ANDROID)
const char kProducerSocketName[] = "@perfetto-ipc-test-producer.sock";
const char kConsumerSocketName[] = "@perfetto-ipc-test-consumer.sock";
#else
const char kProducerSocketName[] = "/tmp/perfetto-ipc-test-producer.sock";
const char kConsumerSocketName[] = "/tmp/perfetto-ipc-test-consumer.sock";
#endif

// Can be called only by root.
void SetUidAndGid(const char* username);

int ConsumerMain(int argc, char** argv);
int ProducerMain(int argc, char** argv);
int ServiceMain(int argc, char** argv);

extern base::UnixTaskRunner* g_task_runner;

}  // namespace perfetto

#endif  // DEMO_COMMON_H_

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

#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/time.h>
#include <time.h>
#include <unistd.h>

#include <algorithm>

#include "base/logging.h"
#include "base/unix_task_runner.h"
#include "demo/common.h"

namespace {

long TimevalToUs(struct timeval* tv) {
  return tv->tv_sec * 1000000l + tv->tv_usec;
}

void WriteCpuUsage() {
  perfetto::g_task_runner->PostDelayedTask(&WriteCpuUsage, 1000);

  struct timespec now_ts;
  PERFETTO_CHECK(clock_gettime(CLOCK_MONOTONIC_RAW, &now_ts) == 0);
  const long now_us = now_ts.tv_sec * 1000000l + now_ts.tv_nsec / 1000;

  struct rusage usg;
  PERFETTO_CHECK(getrusage(RUSAGE_SELF, &usg) == 0);
  long user_us = TimevalToUs(&usg.ru_utime);
  long kern_us = TimevalToUs(&usg.ru_stime);

  static long last_time_us = now_us;
  static long last_user_us = 0;
  static long last_kern_us = 0;
  static long active_us = 0;

  const long tdelta_us = std::max(now_us - last_time_us, 0l);
  last_time_us = now_us;

  long user_percent_1s = 0;
  long kern_percent_1s = 0;
  if (tdelta_us) {
    user_percent_1s = (user_us - last_user_us) * 100 / tdelta_us;
    kern_percent_1s = (kern_us - last_kern_us) * 100 / tdelta_us;
  }
  last_user_us = user_us;
  last_kern_us = kern_us;

  if (user_percent_1s + kern_percent_1s > 0)
    active_us += tdelta_us;

  long user_percent_tot = 0;
  long kern_percent_tot = 0;
  if (active_us) {
    user_percent_tot = user_us * 100 / active_us;
    kern_percent_tot = kern_us * 100 / active_us;
  }

  printf(
      "\x1B[s\x1B[0;50H\x1B[7mCPU: ["
      "1s: %2ld%% /%2ld%%, "
      "Tot: %2ld%% /%2ld%%]\x1B[0m\x1B[u",
      user_percent_1s, kern_percent_1s, user_percent_tot, kern_percent_tot);
  fflush(stdout);
}

}  // namespace

int main(int argc, char** argv) {
  signal(SIGINT, [](int) { exit(2); });
  PERFETTO_LOG("PID: %d", getpid());

  perfetto::g_task_runner = new perfetto::base::UnixTaskRunner();
  perfetto::g_task_runner->PostDelayedTask(&WriteCpuUsage, 1000);

  if (argc > 1 && !strcmp(argv[1], "producer"))
    return perfetto::ProducerMain(argc, argv);

  if (argc > 1 && !strcmp(argv[1], "consumer"))
    return perfetto::ConsumerMain(argc, argv);

  if (argc > 1 && !strcmp(argv[1], "service"))
    return perfetto::ServiceMain(argc, argv);

  printf("Usage: %s  producer | consumer | service\n", argv[0]);
  exit(1);
}

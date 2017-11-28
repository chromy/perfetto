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

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <unistd.h>

#include "base/logging.h"
#include "demo/common.h"


int main(int argc, char** argv) {
  signal(SIGINT, [] (int) {
    exit(2);
  });

  if (argc > 1 && !strcmp(argv[1], "producer"))
    return perfetto::ProducerMain(argc, argv);

  if (argc > 1 && !strcmp(argv[1], "consumer"))
    return perfetto::ConsumerMain(argc, argv);

  if (argc > 1 && !strcmp(argv[1], "service"))
    return perfetto::ServiceMain(argc, argv);

  printf("Usage: %s  producer | consumer | service\n", argv[0]);
  exit(1);
}

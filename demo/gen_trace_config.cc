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
#include <unistd.h>

#include "google/protobuf/descriptor_database.h"
#include "google/protobuf/text_format.h"
#include "google/protobuf/util/json_util.h"
#include "google/protobuf/util/type_resolver_util.h"

#include "base/logging.h"
#include "protos/ipc/trace_config.pb.h"

using namespace ::google::protobuf::util;
using namespace ::google::protobuf;

int main(int argc, char** argv) {
  if (argc > 1 && strcmp(argv[1], "gen") == 0) {
    char buf[4096];
    PERFETTO_LOG("Reading JSON from stdin...\n");
    ssize_t rsize = read(STDIN_FILENO, buf, sizeof(buf));
    PERFETTO_CHECK(rsize > 0);
    perfetto::proto::TraceConfig trace_config;
    std::unique_ptr<TypeResolver> resolver(
        NewTypeResolverForDescriptorPool("", DescriptorPool::generated_pool()));

    std::string out;
    auto status = JsonToBinaryString(&*resolver, "/perfetto.proto.TraceConfig",
                                     buf, &out);
    PERFETTO_ILOG("Parse: %s %s", status.ok() ? "SUCCESS" : "FAIL",
                  status.error_message().data());
    if (status.ok()) {
      PERFETTO_CHECK(!isatty(STDOUT_FILENO));
      write(STDOUT_FILENO, out.data(), out.size());
    }
    return 0;
  }
  printf("Usage: %s gen", argv[0]);
  return 1;
}

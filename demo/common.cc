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

#include "demo/common.h"
#include "base/logging.h"

#include <pwd.h>
#include <sys/types.h>
#include <unistd.h>

namespace perfetto {

base::UnixTaskRunner* g_task_runner;

void SetUidAndGid(const char* username) {

  if (getuid() != 0) {
    PERFETTO_DLOG("Cannot setuid() without being root");
    return;
  }

  struct passwd* creds = getpwnam(username);
  if (!creds) {
    PERFETTO_DLOG("Cannot find user %s, keeping running as root", username);
    return;
  }

  int gid_res = setgid(creds->pw_gid);
  int uid_res = setuid(creds->pw_uid);
  if (gid_res || uid_res) {
    PERFETTO_DLOG("Failed setuid/setgid: %d/%d", uid_res, gid_res);
  } else {
    PERFETTO_DLOG("Switched to user:%s uid:%lu gid:%lu", username,
                  static_cast<unsigned long>(creds->pw_uid),
                  static_cast<unsigned long>(creds->pw_gid));
  }
}

}  // namespace perfetto

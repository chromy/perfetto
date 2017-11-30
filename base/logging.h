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

#ifndef PERFETTO_BASE_LOGGING_H_
#define PERFETTO_BASE_LOGGING_H_

#include <errno.h>
#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>   // For fprintf and stderr.

#if defined(NDEBUG)
#define PERFETTO_DCHECK_IS_ON() 0
#else
#define PERFETTO_DCHECK_IS_ON() 1
#include <string.h>  // For strerror.
#endif

#include "base/utils.h"

namespace perfetto {
namespace base {

constexpr const char* str_end(const char* s) {
  return *s ? str_end(s + 1) : s;
}

constexpr const char* file_name_r(const char* s,
                                  const char* begin,
                                  const char* end) {
  return (*s == '/' && s < end)
             ? (s + 1)
             : ((s > begin) ? file_name_r(s - 1, begin, end) : s);
}

constexpr const char* file_name(const char* str) {
  return file_name_r(str_end(str), str, str_end(str));
}

enum LogLev { kLogDebug = 0, kLogInfo, kLogImportant, kLogError };
constexpr const char* kLogFmt[] = {"\x1b[2m", "\x1b[39m", "\x1b[32m\x1b[1m",
                                   "\x1b[31m"};

#define S(x) #x
#define S_(x) S(x)
#define S__LINE__ S_(__LINE__)

#define PERFETTO_XLOG(level, fmt, ...)                                \
  fprintf(stderr, "\x1b[90m%-24.24s\x1b[0m %s" fmt "\x1b[0m\n",  \
          ::perfetto::base::file_name(__FILE__ ":" S__LINE__),         \
          ::perfetto::base::kLogFmt[::perfetto::base::LogLev::level], \
          ##__VA_ARGS__)

#define PERFETTO_LOG(fmt, ...) PERFETTO_XLOG(kLogInfo, fmt, ##__VA_ARGS__)
#define PERFETTO_ILOG(fmt, ...) PERFETTO_XLOG(kLogImportant, fmt, ##__VA_ARGS__)
#define PERFETTO_ELOG(fmt, ...) PERFETTO_XLOG(kLogError, fmt, ##__VA_ARGS__)

#if PERFETTO_DCHECK_IS_ON()
#define PERFETTO_DLOG(fmt, ...) PERFETTO_XLOG(kLogDebug, fmt, ##__VA_ARGS__)
//                                              \
  // fprintf(stderr, "\n[%s:%d, errno: %d %s]\n" fmt "\n\n", __FILE__, __LINE__, \
  //         errno, errno ? strerror(errno) : "", ##__VA_ARGS__)
#define PERFETTO_DPLOG(...) PERFETTO_DLOG(__VA_ARGS__)
#define PERFETTO_DCHECK(x)                                                 \
  do {                                                                     \
    if (!__builtin_expect(!!(x), true)) {                                  \
      PERFETTO_DLOG("%s", "PERFETTO_CHECK(" #x "). Errno: %d : %s", errno, \
                    strerror(errno));                                      \
      *(reinterpret_cast<volatile int*>(0x10)) = 0x42;                     \
      __builtin_unreachable();                                             \
    }                                                                      \
  } while (0)
#else
#define PERFETTO_DLOG(...) ::perfetto::base::ignore_result(__VA_ARGS__)
#define PERFETTO_DPLOG(...) ::perfetto::base::ignore_result(__VA_ARGS__)
#define PERFETTO_DCHECK(x) ::perfetto::base::ignore_result(x)
#endif  // PERFETTO_DCHECK_IS_ON()

#if PERFETTO_DCHECK_IS_ON()
#define PERFETTO_CHECK(x) PERFETTO_DCHECK(x)
#else
#define PERFETTO_CHECK(x)                            \
  do {                                               \
    if (!__builtin_expect(!!(x), true)) {            \
      PERFETTO_ELOG("%s", "PERFETTO_CHECK(" #x ")"); \
      abort();                                       \
    }                                                \
  } while (0)

#endif  // PERFETTO_DCHECK_IS_ON()

}  // namespace base
}  // namespace perfetto

#endif  // PERFETTO_BASE_LOGGING_H_

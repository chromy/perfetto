// Copyright (C) 2018 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include <unistd.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>

int main(int argc, char** argv) {
  for (int i=1; i<argc; i++) {
    int fd = open(argv[i], O_RDONLY);
    char buf[4096];
    ssize_t bytes = 0;
    while ((bytes = read(fd, &buf, sizeof(buf))) > 0) {
      write(STDOUT_FILENO, &buf, static_cast<size_t>(bytes));
    }
    close(fd);
  }
  return 0;
}

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

#include <string>

namespace {

constexpr char kGlobalPreamble[] = R"(
// Preamble.
(function(){

var ___info = {};
var ___cache = {};

function ___require(path, parent) {
  //if (path[0] === '/')
  //  from = '/';
  if (path.startsWith('./') ||
      path.startsWith('../') ||
      path.startsWith('/')) {
  }
  
  var canonical_path = path;
  for (vaapath.split('/')  
  
  if (___cache[canonical_path])
    return ___cache[canonical_path];
  
  var info = ___info[canonical_path] ;
  if (!info)
    throw "No such module.";

  var module = {
    exports: {},
    id: canonical_path,
    filename: canonical_path,
    loaded: false,
    parent: parent,
  };

  ___cache[canonical_path] = module;
  
  info.load(
    module.exports,
    (path) => ___require(path, canonical_path),
    module,
    module.filename,
    info.dirname);

  module.loaded = true;

  return module;
}

)";

constexpr char kModulePreamble[] = R"(
(function(){
  ___info["$id"] = {
    dirname: "foo",
    load: (function(
        exports,
        require,
        module,
        __filename,
        __dirname) {

)";

const char kModulePostamble[] = R"(
    }),
  };
})();
)";

const char kGlobalPostamble[] = R"(
// Postamble.

___require("ui/perfetto.js", ".")
})();
)";

void replace_all(std::string* str, const std::string& from, const std::string& to) {
  size_t start = str->find(from);
  while (start != std::string::npos) {
    str->replace(start, from.length(), to);
    start = str->find(from, start + to.length());
  }
}

void write_preamble(int fd) {
  write(fd, &kGlobalPreamble, sizeof(kGlobalPreamble)-1);
}

void write_module(int in_fd, int out_fd, char* name) {
  std::string preamble(kModulePreamble);
  replace_all(&preamble, "$id", name);
  write(out_fd, preamble.c_str(), preamble.size());
  char buf[4096];
  ssize_t bytes = 0;
  while ((bytes = read(in_fd, &buf, sizeof(buf))) > 0) {
    write(out_fd, &buf, static_cast<size_t>(bytes));
  }
  write(out_fd, &kModulePostamble, sizeof(kModulePostamble)-1);
}

void write_postamble(int fd) {
  write(fd, &kGlobalPostamble, sizeof(kGlobalPostamble)-1);
}

} // namespace

int main(int argc, char** argv) {
  int out_fd = STDOUT_FILENO;
  write_preamble(out_fd);
  for (int i=1; i<argc; i++) {
    int fd = open(argv[i], O_RDONLY);
    write_module(fd, out_fd, argv[i]);
    close(fd);
  }
  write_postamble(out_fd);
  close(out_fd);
  return 0;
}

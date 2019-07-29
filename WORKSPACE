load(
    "@bazel_tools//tools/build_defs/repo:http.bzl",
    "http_archive",
)

skylib_version = "0.8.0"
http_archive(
    name = "bazel_skylib",
    type = "tar.gz",
    url = "https://github.com/bazelbuild/bazel-skylib/releases/download/{}/bazel-skylib.{}.tar.gz".format (skylib_version, skylib_version),
    sha256 = "2ef429f5d7ce7111263289644d233707dba35e39696377ebab8b0bc701f7818e",
)

http_archive(
    name = "com_google_protobuf",
    sha256 = "8eb5ca331ab8ca0da2baea7fc0607d86c46c80845deca57109a5d637ccb93bb4",
    strip_prefix = "protobuf-3.9.0",
    urls = ["https://github.com/google/protobuf/archive/v3.9.0.zip"],
)

http_archive(
  name = "zlib",
  urls = [
    "https://github.com/madler/zlib/archive/v1.2.11.tar.gz",
  ],
  strip_prefix = "zlib-1.2.11",
  build_file = "@com_google_protobuf//:third_party/zlib.BUILD",
)

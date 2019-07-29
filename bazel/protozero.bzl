def pbzero_cc_proto_library(name, deps, src_proto_library, **kwargs):
  native.cc_library(
    name = name,
    srcs = [":" + name + "_src"],
    hdrs = [":" + name + "_h"],
    **kwargs
  )

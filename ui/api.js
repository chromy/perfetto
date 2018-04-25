let protobuf = require("protobufjs");
let config_json_descriptor = require("./perfetto_config.json");
let trace_json_descriptor = require("./perfetto_trace.json");
let root = new protobuf.Root();
root = protobuf.Root.fromJSON(config_json_descriptor, root);
root = protobuf.Root.fromJSON(trace_json_descriptor, root);
let TraceConfig = root.lookupType("perfetto.TraceConfig")
let Trace = root.lookupType("perfetto.Trace")

module.exports = {
  TraceConfig,
  Trace,
};


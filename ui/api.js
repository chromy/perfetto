let protobuf = require("protobufjs");
let config_json_descriptor = require("./perfetto_config.json");
let trace_json_descriptor = require("./perfetto_trace.json");
let root = new protobuf.Root();
root = protobuf.Root.fromJSON(config_json_descriptor, root);
root = protobuf.Root.fromJSON(trace_json_descriptor, root);
let TraceConfigProto = root.lookupType("perfetto.TraceConfig")
let TraceProto = root.lookupType("perfetto.Trace")

class Trace {
  constructor(name, protobuf) {
    this.name = name;
    this.protobuf = protobuf;
  }

  tracePacketCount() {
    return this.protobuf.packet.length;
  }

  *packets() {
    for (const packet of this.protobuf.packet) {
      yield packet;
    }
  }
}

class Slice {
  constructor(start, end, name) {
    this.start = start;
    this.end = end;
    this.name = name;
  }
}

function* schedSwitchEventsForCpu(trace, cpu, opt_start, opt_end) {
  for (const packet of trace.packets()) {
    if (!packet.ftraceEvents)
      continue;
    const bundle = packet.ftraceEvents;
    if (bundle.cpu !== cpu)
      continue;
    const events = bundle.event;
    for (const evt of events) {
      if (!evt.schedSwitch)
        continue;
      yield evt;
    }
  }
}

function* slicesForCpu(trace, cpu, opt_start, opt_end) {
  let last = null;
  let current = null;
  for (const evt of schedSwitchEventsForCpu(trace, cpu, opt_start, opt_end)) {
    last = current;
    current = evt;
    if (!last)
      continue;
    yield new Slice(last.timestamp, current.timestamp, current.schedSwitch.prevComm);
  }
}

module.exports = {
  TraceConfigProto,
  TraceProto,
  Trace,
  Slice,
  slicesForCpu,
};


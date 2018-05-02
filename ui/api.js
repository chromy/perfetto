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
    this._start = null;
    this._end = null;
  }

  tracePacketCount() {
    return this.protobuf.packet.length;
  }

  *packets() {
    for (const packet of this.protobuf.packet) {
      yield packet;
    }
  }

  _initStartEnd() {
    let [start, end] = computeTraceStartEnd(this);
    this._start = start;
    this._end = end;
  }

  start() {
    if (this._start === null)
      this._initStartEnd();
    return this.absToRelative(this._start);
  }

  end() {
    if (this._end === null)
      this._initStartEnd()
    return this.absToRelative(this._end);
  }

  absToRelative(timestamp) {
    return timestamp - this._start;
  }
}

class Slice {
  constructor(start, end, name) {
    this.start = start;
    this.end = end;
    this.name = name;
    this.duration = end - start;
  }
}

function computeTraceStartEnd(trace) {
  let start = Infinity;
  let end = -Infinity;
  for (let cpu=0; cpu<8; cpu++) {
    for (const evt of schedSwitchEventsForCpu(trace, cpu)) {
      start = Math.min(start, evt.timestamp);
      end = Math.max(end, evt.timestamp);
    }
  }
  return [start, end];
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
    if (last.schedSwitch.nextPid === 0)
      continue;
    const start = trace.absToRelative(last.timestamp);
    const end = trace.absToRelative(current.timestamp);
    yield new Slice(start, end, last.schedSwitch.nextComm);
  }
}

module.exports = {
  TraceConfigProto,
  TraceProto,
  Trace,
  Slice,
  slicesForCpu,
};


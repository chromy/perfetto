let protobuf = require("protobufjs");
let config_json_descriptor = require("./perfetto_config.json");
let trace_json_descriptor = require("./perfetto_trace.json");
let root = new protobuf.Root();
root = protobuf.Root.fromJSON(config_json_descriptor, root);
root = protobuf.Root.fromJSON(trace_json_descriptor, root);
let TraceConfigProto = root.lookupType("perfetto.TraceConfig")
let TraceProto = root.lookupType("perfetto.Trace")

let LAST_TRACE_ID = 0;
class Trace {
  constructor(name, protobuf) {
    this.name = name;
    this.protobuf = protobuf;
    this._start = null;
    this._end = null;
    this.id = LAST_TRACE_ID++;
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

  duration() {
    return this.end() - this.start();
  }

  absToRelative(timestamp) {
    return timestamp - this._start;
  }
}

class Slice {
  constructor(start, end, name, pid) {
    this.start = start;
    this.end = end;
    this.name = name;
    this.duration = end - start;
    this.pid = pid;
  }
}

class SlicesCache {
  constructor() {
    this.cache = new Map();
  }

  slicesForCpu(trace, cpu, opt_start, opt_end) {
    const key = `slices-${trace.id}-${cpu}-${opt_start}-${opt_end}`;
    if (!this.cache.has(key)) {
      let slices = Array.from(computeSlicesForCpu(trace, cpu, opt_start, opt_end));
      this.cache.set(key, slices);
    }
    return this.cache.get(key);
  }

  cpuTime(trace, bucket_size_ms) {
    const key = `time-${trace.id}-${bucket_size_ms}`;
    if (!this.cache.has(key)) {
      let buckets = this.computeCpuTime(trace, bucket_size_ms);
      this.cache.set(key, buckets);
    }
    return this.cache.get(key);
  }

  computeCpuTime(trace, bucket_size_ms) {
    let bucket_size_ns = bucket_size_ms * 1000 * 1000;
    let n = Math.ceil(trace.duration() / bucket_size_ns);
    let buckets = [];
    for (let i=0; i<n+1; i++) {
      buckets.push(0);
    }
    for (let cpu=0; cpu<8; cpu++) {
      for (let slice of this.slicesForCpu(trace, cpu)) {
        let first_bucket = Math.floor(slice.start / bucket_size_ns);
        let last_bucket = Math.ceil(slice.end / bucket_size_ns);
        for (let i=first_bucket; i<last_bucket; i++) {
          let bucket_start = i * bucket_size_ns;
          let bucket_end = bucket_start + bucket_size_ns;
          let start = Math.max(bucket_start, slice.start);
          let end = Math.min(bucket_end, slice.end);
          buckets[i] += Math.max(0, end - start);
        }
      }
    }
    return buckets;
  }
}
const TheSlicesCache = new SlicesCache();


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

function* computeSlicesForCpu(trace, cpu, opt_start, opt_end) {
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
    yield new Slice(start, end, last.schedSwitch.nextComm, last.schedSwitch.nextPid);
  }
}

module.exports = {
  TraceConfigProto,
  TraceProto,
  Trace,
  Slice,
  slicesForCpu: TheSlicesCache.slicesForCpu.bind(TheSlicesCache),
  cpuTime: TheSlicesCache.cpuTime.bind(TheSlicesCache),
};


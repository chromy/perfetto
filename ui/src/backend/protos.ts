import * as x from '../gen/protos';

const TraceConfig = x.perfetto.protos.TraceConfig;
const Trace = x.perfetto.protos.Trace;
const RawQueryResult = x.perfetto.protos.RawQueryResult;
const RawQueryArgs = x.perfetto.protos.RawQueryArgs;

export {
  TraceConfig,
  RawQueryArgs,
  RawQueryResult,
  Trace,
};

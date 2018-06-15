/*
 * Copyright (C) 2018 The Android Open Source Project
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

import { createSender } from '../ipc';
import { TraceProcessorBridge } from '../trace_processor';
import { TraceConfig } from './protos';
import { processNames } from './process_names';
import { ConfigEditorState, FragmentParameters, State, TraceBackendInfo, TraceBackendRequest, TraceBackendState, TrackID, createZeroState } from './state';

let gState: State = createZeroState();
let gTracesController: TracesController|null = null;
let gLargestKnownId = 0;
let gPort: MessagePort|null = null;

function pidToName(id: number): string {
  return processNames[id % processNames.length];
}

function pidToColor(pid: number): string {
  const colors = [
"rgb(262, 161, 161)", "rgb(150, 292, 193)", "rgb(177, 132, 210)", "rgb(287, 265, 128)", "rgb(128, 204, 221)", "rgb(228, 134, 184)", "rgb(204, 331, 158)", "rgb(152, 149, 220)", "rgb(281, 193, 146)", "rgb(133, 256, 209)", "rgb(195, 128, 202)", "rgb(268, 308, 130)", "rgb(134, 179, 223)", "rgb(249, 148, 171)", "rgb(167, 311, 181)", "rgb(167, 137, 215)", "rgb(290, 236, 133)", "rgb(128, 222, 218)", "rgb(215, 129, 192)", "rgb(230, 331, 145)", "rgb(145, 159, 222)", "rgb(270, 172, 155)", "rgb(142, 278, 200)",
  ];
  return colors[pid % colors.length];
}

function createConfig(state: ConfigEditorState): Uint8Array {
  const ftraceEvents: string[] = [];
  const atraceCategories = Object.keys(state.atrace_categories);
  const sizeKb = state.buffer_size_kb ? state.buffer_size_kb : 1024; 
  const durationMs = state.trace_duration_ms ? state.trace_duration_ms : 1000;
  const writeIntoFile = !!state.stream_to_host;
  const fileWritePeriodMs = writeIntoFile ? 1000 : 0;

  return TraceConfig.encode({
    buffers: [
      {
        sizeKb,
        fillPolicy: TraceConfig.BufferConfig.FillPolicy.RING_BUFFER,
      },
    ],
    dataSources: [
      {
        config: {
          name: 'linux.ftrace',
          targetBuffer: 0,
          ftraceConfig: {
            ftraceEvents,
            atraceCategories,
          },
        },
      }
    ],
    producers: [
      {
        producerName: 'perfetto.traced_probes',
        shmSizeKb: 4096,
        pageSizeKb: 4,
      },
    ],
    durationMs,
    writeIntoFile,
    fileWritePeriodMs,
  }).finish();
}

function base64Encode(buffer: Uint8Array): string {
  const s = [...buffer].map(c => {
      return String.fromCharCode(c);
  }).join('');
  return btoa(s);
}

function configToCommandline(config: ConfigEditorState) {
  const s = base64Encode(createConfig(config));
  if (config.stream_to_host) {
    return `echo ${s} | base64 --decode > /tmp/config && \
  adb push /tmp/config /data/local/tmp/config && \
  ./buildtools/android_sdk/platform-tools/adb shell -t "cat /data/local/tmp/config | perfetto -n -c - -o /dev/tty 2>/dev/null" > /tmp/trace`;
  } else {
    return `echo ${s} | base64 --decode | adb shell "perfetto -c - -o /data/misc/perfetto-traces/trace" && adb pull /data/misc/perfetto-traces/trace /tmp/trace`;
  }
}

function computeFragmentParams(state: State): FragmentParameters {
  if (state.fragment === '/config') {
    let params: FragmentParameters = {};
    if (state.config_editor.stream_to_host)
      params['stream_to_host'] = '';
    if (state.config_editor.buffer_size_kb)
      params['buffer_size_kb'] = state.config_editor.buffer_size_kb;
    if (state.config_editor.trace_duration_ms)
      params['trace_duration_ms'] = state.config_editor.trace_duration_ms;
    params['atrace_categories'] = Object.keys(state.config_editor.atrace_categories);
    return params;
  }
  return {};
}

function publishBackend(info: TraceBackendInfo) {
  return {
    topic: 'publish_backend',
    info,
  };
}

function updateDone(id: string) {
  return {
    topic: 'query_done',
    id,
  };
}

function updateTrackData(id: string, data: any) {
  return {
    topic: 'update_track_data',
    id,
    data,
  };
}


class TraceController {
  id: string;
  state: TraceBackendState;
  name: string;
  file: Blob|null;
  remoteTraceProcessorBridge: null|TraceProcessorBridge;
  result: any;
  seenTracks: Set<string>;

  constructor(id: string) {
    this.id = id;
    this.state = 'LOADING';
    this.name = '';
    this.file = null;
    this.remoteTraceProcessorBridge = null;
    this.seenTracks = new Set();
  }

  details(): TraceBackendInfo {
    return {
      id: this.id,
      state: this.state,
      name: this.name,
      result: this.result,
    };
  }

  setup(trace: TraceBackendRequest) {
    console.log('setup');
    this.name = trace.name || '';
    this.state = 'LOADING';
    this.file = trace.file;

    gState.backends[this.id] = this.details();
    (self as any).postMessage({
      topic: 'start_processor',
    });
  }

  update(state: State, request: TraceBackendRequest) {
    if (this.state === 'LOADING' && this.file && gPort) {
      const bridge = createSender<TraceProcessorBridge>(gPort);
      this.remoteTraceProcessorBridge = bridge;
      this.remoteTraceProcessorBridge.loadBlob(this.file).then(() => {
        this.state = 'READY';
        dispatch(publishBackend(this.details()));
      });
      gPort = null;
    }
    if (this.state === 'READY' &&
      this.remoteTraceProcessorBridge &&
      request.needs_update) {
      this.remoteTraceProcessorBridge.query(request.query).then((x: any) => {
        this.result = x;
        dispatch(updateDone(this.id));
        dispatch(publishBackend(this.details()));
      });
    }
    if (this.state === 'READY' && this.remoteTraceProcessorBridge) {
      for (let [id, track] of Object.entries(state.tracks)) {
        if (track == null) continue;  // TS being a little too pedantic here.
        console.log(state.tracks);
        if (this.seenTracks.has(id))
          continue;
        if (!track.query)
          continue;
        this.seenTracks.add(id);
        this.remoteTraceProcessorBridge.query(track.query).then((result: any) => {
          console.log(result);
          let slices: any = [];
          for (let i=0; i<result.numRecords; i++) {
            const start = result.columns[0].ulongValues[i] - 81473011195345;
            const length = result.columns[2].ulongValues[i];
            const pid = result.columns[3].ulongValues[i];
            slices.push({
              start,
              end: start + length,
              title: pidToName(pid),
              color: pidToColor(pid),
              tid: 0,
              pid,
            });
          }
          dispatch(updateTrackData(id, slices));
        });
      }
    }
  }

  teardown() {
    console.log('teardown');
    delete gState.backends[this.id];
  }
}

class TracesController {
  controllers: Map<string, TraceController>;

  constructor() {
    this.controllers = new Map();
  }

  update(state: State) {
    for (const trace of state.traces) {
      if (this.controllers.has(trace.id))
        continue;
      const controller = new TraceController(trace.id);
      this.controllers.set(trace.id, controller)
      controller.setup(trace);
    }

    for (const trace of state.traces) {
      const controller = this.controllers.get(trace.id);
      if (!controller)
        throw 'Missing id';
      controller.update(state, trace);
    }

    const ids = new Set(state.traces.map(t => t.id));
    for (const controller of this.controllers.values()) {
      if (ids.has(controller.id))
        continue;
      controller.teardown();
      this.controllers.delete(controller.id);
    }
  }
}

function dispatch(action: any) {
  const any_self = (self as any);
  switch (action.topic) {
    case 'processor_started': {
      gPort = action.port;
      break;
    }
    case 'init': {
      gState = action.initial_state;
      break;
    }
    case 'navigate':
      gState.fragment = action.fragment;
      break;
    case 'set_buffer_size': {
      const config = gState.config_editor;
      const buffer_size_kb = action.buffer_size_mb * 1024;
      config.buffer_size_kb = buffer_size_kb;
      break;
    }
    case 'set_trace_duration': {
      const config = gState.config_editor;
      const duration_ms = action.duration_s * 1000;
      config.trace_duration_ms = duration_ms;
      break;
    }
    case 'set_stream_to_host': {
      const config = gState.config_editor;
      const enabled = action.enabled;
      config.stream_to_host = enabled;
      break;
    }
    case 'publish_backend': {
      gState.backends[action.info.id] = action.info;
      break;
    }
    case 'set_category': {
      const config = gState.config_editor;
      const category = action.category;
      const enabled = action.enabled;
      if (enabled) {
        config.atrace_categories[category] = true;
      } else {
        delete config.atrace_categories[category];
      }
      break;
    }
    case 'load_trace_file': {
      const file = action.file;
      gState.traces.push({
        name: file.name,
        needs_update: false,
        file: file,
        id: ''+gLargestKnownId++,
        query: '',
      });
      const trackIds : TrackID[] = [];
      for (let i=0; i<8; i++) { 
        const id = ''+gLargestKnownId++;
        gState.tracks[id] = {
          name: `CPU ${i}`,
          height: 100,
          query: `select * from sched_slices where cpu = ${i} limit 100;`,
        };
        trackIds.push({ nodeType: 'TRACK', id});
      }

      gState.trackTrees = {
        "tree1": {
          name: "CPU Trace",
          children: trackIds,
        }
      };

      gState.rootTrackTree = 'tree1';
      break;
    }
    case 'query': {
      const id = action.id;
      const query = action.query;
      for (const trace of gState.traces) {
        if (trace.id === id) {
          trace.needs_update = true;
          trace.query = query;
        }
      }
      break;
    }
    case 'query_done': {
      const id = action.id;
      for (const trace of gState.traces) {
        if (trace.id === id)
          trace.needs_update = false;
      }
      break;
    }
    case 'update_track_data': {
      const id = action.id;
      const data = action.data;
      gState.tracksData[id] = {
        data,
      };
      break;
    }
    default:
      break
  }
  const config = gState.config_editor;
  gState.config_commandline = configToCommandline(config);
  gState.fragment_params = computeFragmentParams(gState);
  if (gTracesController)
    gTracesController.update(gState);
  any_self.postMessage({
    topic: 'new_state',
    new_state: gState,
  });
}

function main() {
  console.log('Hello from the worker!');
  
  gTracesController = new TracesController();

  const any_self = (self as any);
  any_self.onmessage = (m: any) => dispatch(m.data);
}

export {
  main,
};

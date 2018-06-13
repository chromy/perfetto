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

interface ConfigEditorState {
  stream_to_host: boolean,
  buffer_size_kb: number|null,
  trace_duration_ms: number|null,
  atrace_categories: {[s: string]: boolean};
}

interface TraceBackendRequest {
  id: string;
  file: Blob;
  name: string|null;
  query: string;
  needs_update: boolean;
};

type TraceBackendState = 'LOADING' | 'READY' | 'ERROR';
interface TraceBackendInfo {
  id: string;
  state: TraceBackendState;
  name: string;
  result: any;
};

type FragmentParameters = {[s: string]: any};

interface State {
  fragment: string;
  traces: TraceBackendRequest[];
  backends: {[s: string]: TraceBackendInfo};
  config_editor: ConfigEditorState;
  config_commandline: string | null;
  fragment_params: FragmentParameters;

  // Merged from ui/src/state.ts
  gps: {
    startVisibleWindow: number,
    endVisibleWindow: number
  };
  maxVisibleWindow: {
    start: number;
    end: number;
  };
  trackTree: TrackTreeState;
  sliceTrackDataSpec: {
    // Minimal data you need to obtain the complete slice data
    //Rendering Class (maybe - or maybe it's automatically inferred from the TrackDataSpec class?
    //start, end of drawing range,
    //process, thread
    // Does not contain a list of all the slices.
  }
}

interface TrackTreeState {
  metadata: {
    name: string,
    shellColor: string
  };
  children: (TrackTreeState|TrackState)[];
}

interface TrackState {
  metadata: {
    name: string,
  };
  trackData: TrackDataSpec;
}

interface TrackDataSpec {};

interface CpuTrackDataSpec extends TrackDataSpec {}

interface SliceTrackDataSpec extends TrackDataSpec {}

function createZeroState(): State {
  return {
    fragment: "/home",
    config_editor: {
      stream_to_host: false,
      buffer_size_kb: null,
      trace_duration_ms: null,
      atrace_categories: {},
    },
    fragment_params: {},
    traces: [],
    backends: {},
    config_commandline: "echo 'Create a config above'",

    trackTree: {
      metadata: {
        name: '',
        shellColor: '',
      },
      children: [],
    },
    gps: {
      startVisibleWindow: 0,
      endVisibleWindow: 0,
    },
    maxVisibleWindow: {
      start: 0,
      end: 0,
    },
    sliceTrackDataSpec: {
    },
  };
}

export {
  createZeroState,
  FragmentParameters,
  ConfigEditorState,
  TraceBackendRequest,
  TraceBackendState,
  TraceBackendInfo,
  CpuTrackDataSpec,
  SliceTrackDataSpec,
  TrackDataSpec,
  TrackState,
  TrackTreeState,
  State,
};


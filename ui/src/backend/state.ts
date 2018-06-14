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

  gps: GlobalPositioningState;
  maxVisibleWindow: {
    start: number;
    end: number;
  };
  rootTrackTree: string | null;

  // TODO: Consider unifying track and tracktrees.
  // TODO: This method of typing doesn't let us do a null check,
  // even though it's possible for tracks[id] to be null.
  tracks: {[id: string]: TrackState},
  trackTrees: {[id: string]: TrackTreeState}
  tracksData: {[id: string]: TrackData},
}

export interface GlobalPositioningState {
  startVisibleWindow: number,
  endVisibleWindow: number,
}

interface TrackTreeID {
  nodeType: 'TRACKTREE',
  id: string,
}

interface TrackID {
  nodeType: 'TRACK',
  id: string,
}

type TrackNodeID = TrackTreeID | TrackID;

interface TrackTreeState {
  name: string, 
  children: TrackNodeID[],
}

interface TrackState {
  name: string,
  height: number,
  query?: string,
}

interface TrackData {
  data: any,
}

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

    tracks: {},
    trackTrees: {},
    tracksData: {},

    rootTrackTree: null,

    gps: {
      startVisibleWindow: 0,
      endVisibleWindow: 0,
    },
    maxVisibleWindow: {
      start: 0,
      end: 0,
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
  TrackID,
  TrackNodeID,
  TrackTreeID,
  TrackState,
  TrackTreeState,
  State,
};


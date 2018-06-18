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

import {Nanoseconds, Pixels} from '../time-scale';

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

// Adding '|undefined' because of
// https://github.com/Microsoft/TypeScript/issues/23817
type ObjectByID<T> = {[id: string]: T | undefined};

interface State {
  fragment: string;
  traces: TraceBackendRequest[];
  backends: {[s: string]: TraceBackendInfo};
  config_editor: ConfigEditorState;
  config_commandline: string | null;
  fragment_params: FragmentParameters;

  gps: GlobalPositioningState;
  maxVisibleWindow: {
    start: Nanoseconds;
    end: Nanoseconds;
  };
  rootTrackTree: string | null;
  selection: string | null;
  // TODO: Consider unifying track and tracktrees.
  tracks: ObjectByID<TrackState>;
  trackTrees: ObjectByID<TrackTreeState>;
  tracksData: ObjectByID<TrackData>;
}

export interface GlobalPositioningState {
  startVisibleWindow: Nanoseconds,
  endVisibleWindow: Nanoseconds,
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
  id: string;
  name: string;
  height: Pixels;
  query?: string;
}

interface TrackData {
  data: TrackSlice[],
}

// TODO: TrackSlice is a terrible name. Everything goes in a track.
interface TrackSlice {
  id: string;
  start: number;
  end: number;
  title: string;
  color?: string;
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
    selection: null,
  };
}

export {
  createZeroState,
  FragmentParameters,
  ConfigEditorState,
  ObjectByID,
  TraceBackendRequest,
  TraceBackendState,
  TraceBackendInfo,
  TrackData,
  TrackID,
  TrackNodeID,
  TrackTreeID,
  TrackSlice,
  TrackState,
  TrackTreeState,
  State,
};


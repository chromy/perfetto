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

console.log('Hello from the main thread!');


import { TraceUi } from './trace-ui';
import {html, render} from 'lit-html';
import {State} from './state';

function writeToUIConsole(line:string) {
  const lineElement = document.createElement('div');
  lineElement.innerText = line;
  const container = document.getElementById('console');
  if (!container)
    throw new Error('OMG');
  container.appendChild(lineElement);
}

// TODO(primiano): temporary for testing, just instantiates the WASM module on
// the main thread.
(<any>window).Module = {
    locateFile: (s: string) => '/wasm/' + s,
    print: writeToUIConsole,
    printErr: writeToUIConsole,
};

function main() {
  const worker = new Worker("worker_bundle.js");
  worker.onerror = e => {
    console.error(e);
  }
}

main();

const container = document.getElementById('app-container');
if (container) {
  const state: State = {
    loadedTraces: [], // Handles to traces
    gps: {
      startVisibleWindow: 10,
      endVisibleWindow: 2000
    },
    trackTree: {
      metadata: {
        name: 'Trace 1: Pinpoint job 347',
        shellColor: 'red'
      },
      children: [{
        metadata: {
          name: 'Renderer PID: 12341',
          shellColor: 'blue'
        },
        children: []
      }, {
        metadata: {
          name: 'Renderer PID: 32423',
          shellColor: 'yellow'
        },
        children: [{
          metadata: {
            name: 'Metrics Analysis for renderer',
            shellColor: 'green'
          },
          children: [{
            metadata: { name: "Slice Track"},
            trackData: {},
          }],
        }, {
          metadata: { name: "Slice Track"},
          trackData: {}
        }, {
          metadata: { name: "Slice Track"},
          trackData: {}
        }, {
          metadata: { name: "Slice Track"},
          trackData: {}
        }, {
          metadata: { name: "Slice Track"},
          trackData: {}
        }, {
          metadata: { name: "Slice Track"},
          trackData: {}
        }, {
          metadata: { name: "Slice Track"},
          trackData: {}
        }, {
          metadata: { name: "Slice Track"},
          trackData: {}
        }, {
          metadata: { name: "Slice Track"},
          trackData: {}
        }, {
          metadata: { name: "Slice Track"},
          trackData: {}
        }, {
          metadata: { name: "Slice Track"},
          trackData: {}
        }, {
          metadata: { name: "Slice Track"},
          trackData: {}
        }]
      }]
    },
    sliceTrackDataSpec: {}
  };

  const bcr = container.getBoundingClientRect();
  const ui = new TraceUi(state, bcr.width);

  render(html`${ui}`, container);
}

// Set this to say 200 to test compositor scrolling
const mainThreadWaitTimeInMs = 0;

const wait = function(ms: number)
{
  const start = Date.now();
  let i = 0;
  while(Date.now() - start < ms)
  {
    i++;
  }
  console.log(i);
};

const raf = () => {
  if(mainThreadWaitTimeInMs) {
    wait(mainThreadWaitTimeInMs);
  }

  requestAnimationFrame(raf);
};

raf();

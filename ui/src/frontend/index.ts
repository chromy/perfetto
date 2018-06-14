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

import { State, createZeroState } from '../backend/state';
import * as m from 'mithril';
import * as Atrace from  '../backend/atrace';
import { TraceUi } from '../trace-ui';
import { html, render } from 'lit-html';
import { traceDataStore } from '../trace-data-store';

let gState: State = createZeroState();
let gDispatch: (msg: any) => void = _ => {};

function q(f: (e: any) => void): (e: any) => void {
  return function(e) {
    e.redraw = false;
    f(e);
  };
}

function quietDispatch(action: ((e: any) => any)|any): (e: any) => void {
  return function(e: any): void {
    e.redraw = false;
    if (action instanceof Function) {
      return gDispatch(action(e));
    }
    return gDispatch(action);
  }
}

function navigate(fragment: string) {
  return {
    topic: 'navigate',
    fragment,
  };
}

function updateQuery(id: string, query: string) {
  return {
    topic: 'query',
    query,
    id,
  };
}

function setStreamToHost(enabled: boolean) {
  return {
    topic: 'set_stream_to_host',
    enabled,
  };
}

function setCategory(category: string, enabled: boolean) {
  return {
    topic: 'set_category',
    category,
    enabled,
  };
}

function setTraceDuration(duration_s: number) {
  return {
    topic: 'set_trace_duration',
    duration_s,
  };
}

function setBufferSize(buffer_size_mb: number) {
  return {
    topic: 'set_buffer_size',
    buffer_size_mb,
  };
}

function loadTraceFile(file: Blob) {
  return {
    topic: 'load_trace_file',
    file,
  };
}

const Menu: m.Component<{ title: string }> = {
  view(vnode) {
    return m("#menu",
      m('h1', vnode.attrs.title),
    );
  },
};

const Side = {
  view: function() {
    return m("#side",
      m('#masthead',
        m("img#logo[src='logo.png'][width=384px][height=384px]"),
        m("h1", "Perfetto"),
      ),
      m('ul.items', 
        m('li', { onclick: quietDispatch(navigate('/home')) }, 'Home'),
        m('li', { onclick: quietDispatch(navigate('/viewer')) }, 'Trace Viewer'),
        m('li', { onclick: quietDispatch(navigate('/config')) }, 'Config Editor'),
      ),
    );
  },
};

async function copy(text: string|null) {
  if (!text)
    return;
  try {
    await (navigator as any).clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy: ', err);
  }
}

const Checkbox: m.Component<{
  label: string,
  checked: boolean,
  setter: (_: boolean) => void}> = {

  view(vnode) {
    return m('label', m('.checkbox', m('input[type=checkbox]', {
      checked: vnode.attrs.checked,
      onchange: q(m.withAttr('checked', vnode.attrs.setter)),
    }), vnode.attrs.label));
  },
};

const HomePage = {
  view: function() {
    return [
      m(Menu, { title: "Home" }),
      m(Side),
      m('#content.home', 
        m("input[type=file].center", {
          onchange: quietDispatch((e: any) => {
            const file: Blob = e.target.files.item(0);
            return loadTraceFile(file);
          }),
        }, "Load trace"),
        gState.traces.length === 0
        ? m('span.center', 'No traces loaded')
        : m('.traces', Object.values(gState.backends).map(b => 
            m('.trace-card', {
              class: `trace-backend-state-${b.state}`,
            },
            m('.trace-card-name', b.name),
            m('.trace-card-status', b.state),
            m('.trace-card-info',
              b.state === 'READY' ? [
               m('button', {
                 onclick: quietDispatch(navigate(`/query/${b.id}`))
               }, 'Query')
              ] : null,

            ),
          )),
        ),
      ),
    ];
  },
};

const ConfigPage = {
  view: function() {
    return [
      m(Menu, { title: "Config Editor" }),
      m(Side),
      m('#content',
        m('.group', 'Trace Config'),
        m(Checkbox, {
          label: 'Stream to host',
          checked: gState.config_editor.stream_to_host,
          setter: (c: boolean) => gDispatch(setStreamToHost(c)),
        }),
        m('label', m('input[type=number][min=0]', {
            value: (gState.config_editor.trace_duration_ms || 0) / 1000,
            onchange: q(m.withAttr('value', v => gDispatch(setTraceDuration(v)))),
        }), 'Trace duration (seconds)'),
        m('label', m('input[type=number][min=0]', {
            value: (gState.config_editor.buffer_size_kb || 0) / 1024,
            onchange: q(m.withAttr('value', v => gDispatch(setBufferSize(v)))),
        }), 'Buffer size (mb)'),
        Atrace.categories.map(category =>
          m(Checkbox, {
            label: category.name,
            checked: gState.config_editor.atrace_categories[category.tag],
            setter: (c: boolean) => gDispatch(setCategory(category.tag, c)),
          }),
        ),
        gState.config_commandline && [
          m('code.block', gState.config_commandline),
          m('button', {
            onclick: () => copy(gState.config_commandline)
          }, 'Copy to clipboard'),
        ],
      ),
    ];
  },
};

const QueryPage = {
  view: function() {
    const id = m.route.param('id');
    let request = null;
    for (const trace of gState.traces) {
      if (id === trace.id) 
        request = trace; 
    }
  
    if (!request)
      return [];

    return [
      m(Menu, { title: "Raw Query" }),
      m(Side),
      m('#content',
        m('input.big', {
            value: request.query,
            onchange: q(m.withAttr('value', v => gDispatch(updateQuery(id, v)))),
        }),
        table(gState.backends[id].result),
      ),
    ];
  },
};

function table(result: any): any {
  if (!result)
    return m('');

  const extract = (d: any, i: number): number => {
    if (d.ulongValues.length > 0)
      return d.ulongValues[i];
    if (d.uintValues.length > 0)
      return d.uintValues[i];
    return 0;
  };
  return m('table',
    m('thead', m('tr', result.columnDescriptors.map((d: any) => m('th', d.name)))),
    m('tbody', Array.from(Array(1000).keys()).map(i => {
      return m('tr', result.columns.map((c: any) => {
        return m('td', extract(c, i));
      }));
    })),
  );
}

const ViewerPage: m.Component = {
  oncreate(vnode) {
    //reinitializeUI(vnode);
    const root = vnode.dom;
    const rect = root.getBoundingClientRect();
    const ui = new TraceUi(gState, rect.width, rect.height);
    render(html`${ui}`, root);
    traceDataStore.initialize(
      () => gState,
      () => ui._invalidateProperties());
  },

  onupdate(vnode) {
    const ui = (vnode.dom.firstElementChild as TraceUi);
    ui.setState(gState);
  },

  view() {
    return [
      m('#trace-ui-container'),
      m(Menu, { title: "Home" }),
      m(Side),
    ];
  },
};

function readParam<T>(key: string, setter: (param: T) => void): void {
  const param: undefined|T = (m.route.param(key) as any);
  if (param === undefined)
    return;
  setter(param);
}

function readState(): State {
  const state: State = createZeroState();
  if (!m.route.get())
    return state;

  const fragment = m.route.get()
  if (fragment.startsWith('/config')) {
    state.fragment = '/config';
    readParam<boolean>('stream_to_host',
      _ => state.config_editor.stream_to_host = true);
    readParam<number>('buffer_size_kb',
      v => state.config_editor.buffer_size_kb = v);
    readParam<number>('trace_duration_ms',
      v => state.config_editor.trace_duration_ms = v);
    readParam<string[]>('atrace_categories',
      v => v.forEach((c: string) =>
        state.config_editor.atrace_categories[c] = true));
  }

  return state;
}

function tryReadState(): State {
  try {
    return readState();
  } catch (error) {
    console.error(`Failed to parse state ("${error}") falling back to empty state.`);
    return createZeroState();
  }
}

function updateState(new_state: State): void {
  const old_state = gState;
  gState = new_state;

  if (old_state.fragment == new_state.fragment) {
    if (new_state.fragment === '/config') {
      m.route.set(gState.fragment, new_state.fragment_params, {
        replace: true,
        state: {
        }
      });
    }
    m.redraw();
    return;
  }

  m.route.set(gState.fragment, new_state.fragment_params, {
    replace: false,
    state: {
    }
  });
}

function startProcessor(): Promise<MessagePort> {
  const processor = new Worker("processor_bundle.js");
  processor.onerror = e => {
    console.error(e);
  };
  return new Promise<MessagePort>((resolve, _reject) => {
      processor.onmessage = msg => resolve(msg.data);
  });
}

function main() {
  console.log('Hello from the main thread!');
  const worker = new Worker("worker_bundle.js");
  worker.onerror = e => {
    console.error(e);
  }
  worker.onmessage = msg => {
    switch (msg.data.topic) {
      case 'new_state':
        updateState(msg.data.new_state);
        break;
      case 'start_processor':
        startProcessor().then(port =>
          worker.postMessage({
            topic: 'processor_started',
            port,
          }, [port])
        );
        break;
    }
  };

  const root = document.querySelector('main');
  if (root == null) {
    console.error('No main element found.');
    return;
  }
  m.route(root, "/home", {
    "/home": HomePage,
    "/config": ConfigPage,
    "/viewer": ViewerPage,
    "/query/:id": QueryPage,
  });

  gState = tryReadState();

  gState.gps = {
    startVisibleWindow: 10,
    endVisibleWindow: 2000,
  };
  gState.maxVisibleWindow = {
    start: 0,
    end: 10000,
  };

  gState.tracks = {
    'foo1': { metadata: { name: "Slice Track 1"}, query: "" },
    'foo2': { metadata: { name: "Slice Track 2"}, query: "" },
    'foo3': { metadata: { name: "Slice Track 3"}, query: "" },
    'foo4': { metadata: { name: "Slice Track 4"}, query: "" },
    'foo5': { metadata: { name: "Slice Track 5"}, query: "" },
    'foo6': { metadata: { name: "Slice Track 6"}, query: "" },
    'foo7': { metadata: { name: "Slice Track 7"}, query: "" },
    'foo8': { metadata: { name: "Slice Track 8"}, query: "" },
    'foo9': { metadata: { name: "Slice Track 9"}, query: "" },
    'foo10': { metadata: { name: "Slice Track 10"}, query: "" }
  };

  gState.trackTree = {
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
        children: [],
        trackIds: ['foo1']
      }],
      trackIds: ['foo2', 'foo3', 'foo4', 'foo5', 'foo6', 'foo7', 'foo8', 'foo9', 'foo10']
    }]
  };

  m.redraw();

  gDispatch = worker.postMessage.bind(worker);
  gDispatch({
    topic: 'init',
    initial_state: gState,
  });
}

export {
  main,
};

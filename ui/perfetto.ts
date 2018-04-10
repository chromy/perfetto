// Copyright (C) 2018 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as m from 'mithril';
import * as protobuf from "protobufjs";

let json_descriptor = require("./perfetto_config.json");
let root = protobuf.Root.fromJSON(json_descriptor);
let TraceConfig = root.lookupType("perfetto.TraceConfig");

console.log(json_descriptor);
console.log(root);
console.log(TraceConfig);

function download(data, file_name) {
  let mime_type = 'application/octet-stream';
  let blob = new Blob([data], {
    type: mime_type
  });
  let url = window.URL.createObjectURL(blob);

  let a = document.createElement('a');
  a.href = url;
  a.download = file_name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

class Config {
  name: string;
  data: protobuf.Message<{}>;

  constructor(name: string) {
    this.name = name;
    this.data = TraceConfig.create();
  }

  setName(name: string) {
    console.log("name is ", name, this.name);
    this.name = name;
  }

  details() {
    let details = [];
    details.push(this.data['buffers'].length + ' buffers');
    details.push(this.data['dataSources'].length + ' data sources');

    return details;
  }
}

let Configs = [
  new Config('ftrace.cfg'),
  new Config('atrace.cfg'),
];

class Home {
  focused_config: Config | null;
  new_config: Config;

  constructor() {
    this.focused_config = null;
    this.new_config = new Config("");
    this.focused_config = Configs[0];
  };

  createNewConfig() {
    this.focused_config = new Config("");
  }

  isEditingConfig() {
    return this.focused_config !== null;
  }

  editConfig(config: Config) {
    this.focused_config = config;
  }

  stopEditingConfig() {
    this.focused_config = null;
  }
}

let TheHome = new Home();

function ConfigListView(home) {
  function ConfigListItemView(config) {
    let name = config.name;
    let action = m('.big-list-item-action', {onclick: () => home.editConfig(config)}, "edit");
    let summary = m('span', config.details().join(' - '));

    if (config === home.new_config) {
      name = m('.var-text', config.name ? config.name : 'New Config');
      action = m('.big-list-item-action', {onclick: () => home.editConfig(config)}, "create");
      summary = m('.var-text', 'Details about the config will appear here');
      if (config === home.focused_config)
        summary = m('span', config.details().join(' - '));
    }

    if (config === home.focused_config)
      action = m('.big-list-item-action', {onclick: () => home.stopEditingConfig()}, "close")
    return m('li.big-list-item', [
        m('.big-list-item-header', name),
        m('.big-list-item-body', summary),
        action,
    ]);
  }

  return m(".mixer-column", [
    m('h1', 'Configs'),
    m('ul.big-list',
      m('li.help-text', 'Create, edit, and download configs'),
      m('li.inset', 'Drag and drop or ', m('a[href=""]', 'click to import'), '.'),
      //m('li.big-list-item', BigListItemView(
      ConfigListItemView(home.new_config),
      Configs.map(c => ConfigListItemView(c))),
  ]);
}

function DevicesListView(home) {
  return m(".mixer-column", [
    m('h1', 'Devices'),
    m('ul.big-list', [
      m('li.help-text', 'Manage devices'),
      m('li.inset', 'Drag and drop or ', m('a[href=""]', 'click to import'), '.'),
      m('li.big-list-item', [
        m('.big-list-item-header', "hjd0.lon.corp.google.com"),
        m('.big-list-item-body', '4.9.0-6-amd64'),
        m('.big-list-item-action', {onclick: () => {}}, "details"),
      ]),
      m('li.big-list-item', [
        m('.big-list-item-header', 'Pixel 2'),
        m('.big-list-item-body', '0123456789ABCDEF'),
        m('.big-list-item-action', {onclick: () => {}}, "details"),
      ]),
  ])]);
}

function TracesListView(home) {
  return m(".mixer-column", [
    m('h1', 'Traces'),
    m('ul.big-list', [
      m('li.help-text', 'View traces'),
      m('li.inset', 'Drag and drop or ', m('a[href=""]', 'click to import'), '.'),
    ])
  ]);
}

function getset(o, key) {
  return function(...args : any[]) {
    let value = args[0];
    if (value === undefined)
      return o[key];
    o[key] = value;
  }
}

function ProtoEditorFieldsView(type, proto) {
  let fields = [];
  for (let field of Object.values(type.fields)) {
    fields.push(ProtoEditorFieldView(field, proto));
  }
  return fields;
}

function ProtoEditorFieldView(field, proto) {
  if (field.repeated)
    return ProtoEditorRepeatedFieldView(field, proto);

  let value = getset(proto, field.name);
  return ProtoEditorSingleFieldView(field, value);
}

function ProtoEditorRepeatedFieldView(field, proto) {
  let vs = proto[field.name];
  let elements = [];

  function newElement() {
    if (field.resolvedType === null)
      return field.typeDefault;
    return field.resolvedType.create();
  }

  for (let i=0; i<vs.length; i++) {
    elements.push(ProtoEditorSingleFieldView(field, getset(vs, i)));
  }

  return m('.repeat', [
    elements,
    m('button', { onclick: () => vs.push(newElement()) }, 'Add ' + field.name),
  ]);
}

function ProtoEditorSingleFieldView(field, value) {
  field.resolve();
  if (field.type === 'string') 
    return ProtoEditorStringView(field, value);
  if (field.type === 'bool') 
    return ProtoEditorBoolView(field, value);
  if (['uint32', 'uint64', 'int32', 'int64'].indexOf(field.type) != -1)
    return ProtoEditorNumberView(field, value);
  if (field.resolvedType.values != undefined)
    return ProtoEditorEnumView(field, value);
  return ProtoEditorNestedView(field, value);
}

function ProtoEditorEnumView(field, value) {
  let type = field.resolvedType;
//  let current = parseInt(parent[field.name]);
  console.log('enum', value(), field);

  return m('.editor', [
    m('label', field.name),
    m('select[name="text"]',
      { onchange: e => value(parseInt(e.target.value)) },
      Object.entries(type.values).map(([v, n]) => m('option', { 
        value: n,
        selected: v === value(),
      }, v)),
    ),
  ]);
}

function ProtoEditorNestedView(field, value) {
  //  let type = root.lookupType('perfetto.' + field.type);
  let type = field.resolvedType;
  if (value() === null) {
    return m('.editor', [
      m('label', field.name),
      m('button', {
        onclick: () => value(type.create()),
      }, 'add'),
    ]);
  }

  return m('.editor.column', [
    m('label', field.name),
    m('.nest', ProtoEditorFieldsView(type, value())),
  ]);
}

function ProtoEditorBoolView(field, value) {

  let values = [null, true, false];
  let names = ['unset', 'true', 'false'];

  let value_name = names[values.indexOf(value())];
  let next_value = values[(values.indexOf(value()) + 1) % names.length];

  return m('.editor', [
    m('label', field.name),
    m('button', {
      onclick: () => value(next_value),
    }, value_name),
  ]);
}

function ProtoEditorStringView(field, value) {
  return m('.editor', [
    m('label', field.name),
    m('input', {
      oninput: m.withAttr('value', value),
      value: value(),
    })
  ]);
}

function ProtoEditorNumberView(field, value, hint = null) {
  function tryNumber(n) {
    let reg = new RegExp('^[+-]?[0-9]+$');
    if (n === '')
      return null;
    if (reg.test(n))
      return parseInt(n);
    return n;
  }
  function isValid(n) {
    if (n === '')
      return true;
    let reg = new RegExp('^[+-]?[0-9]+$');
    return reg.test(n);
  }

  return m('.editor', [
    m('label', field.name),
    hint ? hint(value()) : null,
    m('input', {
      class: isValid(value()) ? '' : 'invalid',
      oninput: m.withAttr('value', v => value(tryNumber(v))),
      value: '' + value(),
    }),
  ]);
}

function DownloadConfig(config) {
  let error = TraceConfig.verify(config.data);
  if (error) {
    console.error("Could not validate config.", error)
    return;
  }
  let buffer = TraceConfig.encode(config.data).finish();
  download(buffer, config.name + '.pb');
}

function DownloadConfigAsPbtxt(config) {
  let error = TraceConfig.verify(config.data);
  if (error) {
    console.error("Could not validate config.", error)
    return;
  }
  let buffer = TraceConfig.encode(config.data).finish();
  download(buffer, config.name + '.pbtxt');
}

function ConfigEditorView(config) {
  let text = '';
  let proto_type = TraceConfig;
  console.log(config.data);
  text += TraceConfig.name;
  text += '\n';
  for (let field of Object.values(proto_type.fields)) {
    text += '  ' +  field.name + " (" + field.type + ")\n";
  }

  let fields = ProtoEditorFieldsView(proto_type, config.data);

  return [
    m('h1', 'Editing'),
    m('input.big-input', {
      oninput: m.withAttr('value', name => { config.name = name }),
      value: config.name,
    }),
    m('.sentence', [
      'Download ',
      m('button', { onclick: () => DownloadConfig(config)}, 'as .pb'),
      ' ',
      m('button', { onclick: () => DownloadConfigAsPbtxt(config)}, 'as .pbtxt'),
      // m('button', { onclick: () => DownloadConfigAsPbtxt(config)}, 'copy command to clipboard'),
    ]),
    m('.sentence', [
      'Copy ',
      m('button', { onclick: () => {} }, 'as commandline'),
    ]),
    m('.fields', fields),
  ];
}

function ControlsView(home) {
  return m('.controls', [
    m('h1', 'The controls are here'),

  ]);
}

let HomeComponent = {
  view: function() {
    let home = TheHome;
    if (home.isEditingConfig()) {
      let config = home.focused_config;
      return m("#mixer", [
        ConfigListView(home),
        m('.mixer-config-editor', ConfigEditorView(config)),
        ControlsView(home),
      ]);
   }

    return m("#mixer", [
      ConfigListView(home),
      DevicesListView(home),
      TracesListView(home),
      ControlsView(home),
    ]);
  }
};

m.route(document.querySelector('main'), '/', {
  '/': HomeComponent,
});

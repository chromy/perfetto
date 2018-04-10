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
    let num_buffers = this.data['buffers'].length;
    return [num_buffers + ' buffers'];
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
      name = m('.help-text', config.name ? config.name : 'New Config');
      action = m('.big-list-item-action', {onclick: () => home.editConfig(config)}, "create");
      summary = m('.help-text', 'Details about the config will appear here');
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
      m('li.help-text', 'Create, edit and manage configs here.'),
      m('li.inset', 'Drag and drop or ', m('a[href=""]', 'click to import'), '.'),
      //m('li.big-list-item', BigListItemView(
      ConfigListItemView(home.new_config),
      Configs.map(c => ConfigListItemView(c))),
  ]);
}

function ProtoEditorFieldsView(type, proto) {
  let fields = [];
  for (let field of Object.values(type.fields)) {
    fields.push(ProtoEditorFieldView(field, proto));
  }
  return fields;
}

function ProtoEditorFieldView(field, parent) {
  field.resolve();
  console.log('parent', parent);
  console.log(field);
  console.log(field.name);
  console.log(field.resolvedType);
  if (field.repeated)
    return null;
  if (field.type === 'string') 
    return ProtoEditorStringView(field, parent);
  if (field.type === 'bool') 
    return ProtoEditorBoolView(field, parent);
  if (['uint32', 'uint64', 'int32', 'int64'].indexOf(field.type) != -1)
    return ProtoEditorNumberView(field, parent);
  if (field.resolvedType.values != undefined)
    return ProtoEditorEnumView(field, parent);
  return ProtoEditorNestedView(field, parent);
}

function ProtoEditorEnumView(field, parent) {
  console.log('enum');
  return m('div');
}

function ProtoEditorNestedView(field, parent) {
  //  let type = root.lookupType('perfetto.' + field.type);
  console.log('ProtoEditorNestedView', field, parent);
  let type = field.resolvedType;
  let child = parent[field.name];
  if (child === null) {
    return m('.editor', [
      m('label', field.name),
      m('button', {
        onclick: () => parent[field.name] = type.create(),
      }, 'add'),
    ]);
  }

  return m('.editor.column', [
    m('label', field.name),
    m('.nest', ProtoEditorFieldsView(type, child)),
  ]);
}

function ProtoEditorBoolView(field, parent) {
  console.log(field.name, parent[field.name]);

  let values = [undefined, true, false];
  let names = ['unset', 'true', 'false'];

  let value = parent[field.name];
  let value_name = names[values.indexOf(value)];
  let next_value = values[(values.indexOf(value) + 1) % names.length];

  return m('.editor', [
    m('label', field.name),
    m('button', {
      onclick: () => parent[field.name] = next_value,
    }, value_name),
  ]);
}

function ProtoEditorStringView(field, parent) {
  console.log("String View", field, parent);
  return m('.editor', [
    m('label', field.name),
    m('input', {
      oninput: m.withAttr('value', v => parent[field.name] = v),
      value: parent[field.name],
    })
  ]);
}

function ProtoEditorNumberView(field, parent, hint = null) {
  console.log('ProtoEditorNumberView', field, parent);
  return m('.editor', [
    m('label', field.name),
    hint ? hint(parent[field.name]) : null,
    m('input', {
      oninput: m.withAttr('value', v => parent[field.name] = v),
      value: parent[field.name],
    }),
  ]);
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

  let fields = [];
  for (let field of Object.values(proto_type.fields)) {
    fields.push(ProtoEditorFieldView(field, config.data));
  }

  return [
    m('h1', 'Editing'),
    m('input.big-input', {
      oninput: m.withAttr('value', name => { config.name = name }),
      value: config.name,
    }),
    m('.fields', fields),
  ];
}

let HomeComponent = {
  view: function() {
    let home = TheHome;
    if (home.isEditingConfig()) {
      let config = home.focused_config;
      return m("#mixer", [
          ConfigListView(home),
          m('.mixer-config-editor', ConfigEditorView(config)),
      ]);
   }

    return m("#mixer", [
        ConfigListView(home),
        m(".mixer-column", [
          m('h1', 'Devices'),
        ]),
        m(".mixer-column", [
          m('h1', 'Traces'),
        ]),
    ]);
  }
};

m.route(document.querySelector('main'), '/', {
  '/': HomeComponent,
});

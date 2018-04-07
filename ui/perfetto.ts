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

class Config {
  constructor(name) {
    this.name = name;
  }
}

let Configs = [
  new Config('ftrace.cfg'),
  new Config('atrace.cfg'),
];

class Home {
  constructor() {
    this.state = 'overview';
  }

  createNewConfig() {
    this.state = 'edit';
    console.log('createNewConfig');
  }
}

let TheHome = new Home();

function ConfigListView(home) {
  return m(".mixer-column", [
    m('h1', 'Configs'),
    m('ul.big-list', 
      m('li.help-text', 'Create, edit and manage configs here.'),
      m('li.inset', 'Drag and drop or ', m('a[href=""]', 'click to import'), '.'),
//      m('li.card', {onclick: () => home.createNewConfig()}, 'Create new config'),
      m('li.big-list-item', BigListItemView(
          m('.help-text', 'New Config'),
          m('.help-text', 'Details about the config will appear here'), 'create')),
      Configs.map(c => ConfigListItemView(c))),
  ]);
}

function ConfigListItemView(config) {
  return BigListItemView(
      config.name,
      ['12kb', '7 buffers'].join(' - '),
      'edit');
}

function BigListItemView(name, body, action) {
  return m('li.big-list-item', [
      m('.big-list-item-header', name),
      m('.big-list-item-body', body),
      action ? m('.big-list-item-action', action) : null,
  ]);
}

function ConfigEditorView() {
  return m('h1', 'Editing');
}

let HomeComponent = {
  view: function() {
    home = TheHome;
    if (home.state === 'overview')
      return m("#mixer", [
          ConfigListView(home),
          m(".mixer-column", [
            m('h1', 'Devices'),
          ]),
          m(".mixer-column", [
            m('h1', 'Traces'),
          ]),
      ]);

    if (home.state === 'edit')
      return m("#mixer", [
          ConfigListView(home),
          m('.mixer-config-editor', ConfigEditorView()),
      ]);
  }
};

m.route(document.querySelector('main'), '/', {
  '/': HomeComponent,
});

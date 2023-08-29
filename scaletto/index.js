
const LOADING = Symbol("loading");
const DONE = Symbol("done");
const ERROR = Symbol("error");


function isError(o) {
  return o.status === ERROR;
}

function isDone(o) {
  return o.status === DONE;
}

function isLoading(o) {
  return o.status === LOADING;
}

function makeLoading() {
  return {status: LOADING};
}

function makeDone(data) {
  return {status: DONE, data};
}

function makeError(error) {
  return {status: ERROR, error};
}

function doneOr(r, otherwise) {
  if (isDone(r)) {
    return r.data;
  } else {
    return otherwise;
  }
}

function sleep(ms) {
  return new Promise((resolve, _) => {
    setTimeout(resolve, ms);
  });
}

async function getSize() {
  await sleep(1000);
  return 42;
}

class Connection {
  constructor() {
  }

  get size() {
    if (this._size) {
      return makeDone(this._size);
    }
    if (this._pending_size) {
      return makeLoading();
    }
    this._pending_size = getSize();
    this._pending_size.then((result) => {
      this._size = result;
    }).finally(() => {
      this._pending_size = undefined;
      m.redraw();
    });
    return makeLoading();
  }

  get traces() {
    return makeDone(Array.from(iter(10000)).map(row => {
      return {
        id: `someLongUniqueId#${row}`
      };
    }));
  }

}

const NumberWidget = {
  view({attrs}) {
    const result = attrs.result;
    if (isLoading(result)) {
      return m("span", "...");
    }
    if (isError(result)) {
      return m("span", result.error);
    }
    if (isDone(result)) {
      return m("span", result.data);
    }
  }
}

function * iter(n) {
  for (let i = 0; i<n; ++i) {
    yield i;
  }
}

const HEX = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];

const Overview = {
  view({attrs}) {
    const {traces} = attrs;
    const sz = traces.length;

    const per_row = 120;
    const per_letter = 15;
    const row_count = Math.ceil(sz / (per_row * per_letter));
    const letters = [];

    for (let i = 0; i < row_count; ++i) {
      for (let j = 0; j < per_row; ++j) {
        let count = 0;
        for (let k = 0; k < per_letter; ++k) {
          const n = i * per_row * per_letter + j * per_letter + k;
          if (n > sz) {
            continue;
          }
          count += 1;
        }
        const l = HEX[count];
        letters.push(m("span", l));
      }
      letters.push(m("span", "\n"));
    }


    return m(".overview.pane",
      m("pre", letters),
    );
  },
};


const Chevron = {
  view() {
    return m("svg.chevron", {
        width: "16",
        height: "16",
        viewBox: "0 0 16 16",
        fill: "none",
        xmlns:"http://www.w3.org/2000/svg"
      },
      m("path", {
        d: "M5 1L10.6869 7.16086C10.8637 7.35239 10.8637 7.64761 10.6869 7.83914L5 14",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
      }),
    );
  }
};

const Filter = {
  view({attrs, children}) {
    const {onclick} = attrs;
    return m("a[href=#]", {onclick}, children);
  }
};

class Scaletto {
  constructor() {
    this._filters = [];
    this.viz = '';
  }

  set filters(newFilters) {
    this._filters = newFilters;
  }

  get filters() {
    return this._filters;
  }



}

class Bitmap {
  constructor(n) {
    this.size = n;
    this._data = Array.from(iter()).map(() => false);
  }

  set(i, value) {
    this._data[i] = value;
  }

  get(i) {
    return this._data[i];
  }
}

const ProgressiveFilter = {
  view({attrs}) {
    const {model} = attrs;

    return m(".progressive-filter.center.pane",
      m(Filter, {onclick: () => model.filters = []}, "∀", m(Chevron)),
      model.filters.map((f, i) => {
        return m(Filter, {onclick: () => model.filters = model.filters.slice(0, i) }, i, m(Chevron));
      }),
      m(Filter, {onclick: () => model.filters = model.filters.concat("mine") }, "+"),
    );
  }
};


const JUST_QUERY = Symbol('just-query');
const JUST_VIZ = Symbol('just-query');
const BOTH = Symbol('both');

const settings = {
  liveQuery: true,
  liveViz: true,
  layout: BOTH,
};

const Checkbox = {
  view({attrs, children}) {
    const {rw} = attrs;
    return m("label",
      children,
      m("input[type=checkbox]", {
        checked: rw(),
        onchange: (e) => {
          rw(!rw());
        },
      }),
    );
  },
};

function toRw(o, key) {
  return (maybeNewValue) => {
    if (maybeNewValue === undefined) {
      return o[key];
    } else {
      o[key] = maybeNewValue;
    }
  };
}

const MetaControls = {
  view() {
    return m(".meta-controls.center.pane",
      m(Checkbox, {rw: toRw(settings, "liveQuery")}, "Live query"),
      m(Checkbox, {rw: toRw(settings, "liveViz")}, "Live viz"),


      m("button", {onclick: () => settings.layout = JUST_QUERY}, "✍️"),
      m("button", {onclick: () => settings.layout = BOTH}, "✍️📈"),
      m("button", {onclick: () => settings.layout = JUST_VIZ}, "📈"),

    );
  }
};

const History = {
  view() {
    return m(".history.center.pane",

    );
  }
};


const QueryEditor = {
  view({attrs}) {
    const {model} = attrs;
    return m(".query-editor.pane",
      m(ed.Editor),
    );
  }
};

const QueryResult = {
  view({attrs}) {
    const {model} = attrs;
    return m(".query-result.pane",
      m(".query-result-content",
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
        m('', "a"),
      ),
    );
  }
};

const VizEditor = {
  view({attrs}) {
    const {model} = attrs;
    return m(".viz-editor.pane",
      m(ed.Editor, {
        onUpdate: (text) => {
          if (settings.liveViz) {
            model.viz = text;
            m.redraw();
          }
        },

        onExecute: (text) => {
          model.viz = text;
          m.redraw();
        },

      }),
    );
  }
};

const VizResult = {

  oninit({attrs}) {
    const {model} = attrs;
    this.spec = model.viz;
    this.generation = 0;
  },

  onupdate({attrs}) {
    const {model} = attrs;
    if (this.spec !== model.viz) {
      this.generation += 1;
      this.spec = model.viz;
      m.redraw();
    }
  },

  view({attrs}) {
    const {model} = attrs;
    return m(".viz-result.pane",
      m(Vega, {key: this.generation, spec: this.spec}),
    );
  }

};

function getLayoutClass() {
  switch (settings.layout) {
    case JUST_QUERY:
      return "home-just-query";
    case JUST_VIZ:
      return "home-just-viz";
    case BOTH:
      return "";
  }
}

const Home = {
  oninit() {
    this.conn = new Connection();
    this.model = new Scaletto();
  },

  view(attrs) {
    const conn = this.conn;
    const size = conn.size;
    const traces = doneOr(conn.traces, []);
    const model = this.model;

    return m(".home",
      {
        class: getLayoutClass(),
      },
      m(".status", "Loaded traces #", m(NumberWidget, {result: size})),
      m(Overview, {traces}),
      m(ProgressiveFilter, {model}),
      m(MetaControls, {model}),
      m(QueryEditor, {model}),
      m(QueryResult, {model}),
      m(VizEditor, {model}),
      m(VizResult, {model}),
      m(History, {model}),
    );
  },
};

const Vega = {

  oncreate({attrs, dom}) {
    const {spec} = attrs;
    let j = {};
    try {
      j = JSON.parse(spec);
    } catch (e) {
      return;
    }
    vegaEmbed(dom, j).then(result => {
      this.viz = result.view;
    }).catch(console.error);
  },

  view() {
    return m("");
  },
};

function main() {
  const e = document.querySelector("main");
  m.route(e, "/", {
    "/": Home,
  });
}

main();

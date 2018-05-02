/* tslint:disable */
let d3 = require("d3");
let m = require("mithril");
let api = require("./api.js");


class TraceStore {
  constructor() {
    this.pending = new Set();
    this.traces = [];
  }

  loadFromFile(file, opt_name) {
    let name = opt_name ? opt_name : file.name; 
    console.info(`Load from file ${name}`);
    let promise = new Promise((resolve, reject) => {
      let reader = new FileReader();
      reader.onload = () => resolve(reader.result); 
      reader.readAsArrayBuffer(file);
    });
    this.pending.add(promise);
    return promise.then(buffer => {
      console.info(`Finished loading ${name}`);
      this.pending.delete(promise);
      let uint8array = new Uint8Array(buffer)
      console.info(`Parsing ${name}`);
      let decoded = api.TraceProto.decode(uint8array);
      console.info(`Finished parsing ${name}`);
      this.traces.push(new api.Trace(name, decoded));
      // TODO(hjd): Remove.
      let slices = [];
      for (const slice of api.slicesForCpu(this.traces[this.traces.length-1], 0)) {
        slices.push(slice);
      }
      m.redraw();
    });
  }

  loadFromUrl(url) {
    console.info(`Load from url ${name}`);
    return fetch(url).then(r => r.blob()).then(b => this.loadFromFile(b, url));
  }

  loadFromDropEvent(e) {
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        if (e.dataTransfer.items[i].kind !== 'file')
          continue;
        return this.loadFromFile(e.dataTransfer.items[i].getAsFile());
      }
    } else {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        return this.loadFromFile(e.dataTransfer.files[i]);
      }
    } 
  } 
}

let TheTraceStore = new TraceStore();

let FileUploader = {
  view: function(vnode) {
    return m('.drop.inset', {
      ondrop: e => {
        e.preventDefault();
        this.dragging = false;
        TheTraceStore.loadFromDropEvent(e);
      },
      ondragenter: () => this.dragging = true,
      ondragleave: () => this.dragging = false,
      ondragover: e => e.preventDefault(),
    }, this.dragging ? 'Drop trace file to load' : 'Drag and drop traces here');
  },
};

let TraceList = {
  view: function() {
    return m('ul',
      Array.from(TheTraceStore.pending).map(pending => m('li', [
        `Pending upload.`
      ])),
      TheTraceStore.traces.map(trace => m('li', [
        `${trace.name} has ${trace.tracePacketCount()} trace packets.`
      ])),
    );
  },
};

const ZOOM_STEP = 1.25;
const PAN_STEP = 5;

const TimelineTrackState = {
  sidePanelDisplayed: true,
  xStart: 0,
  xEnd: 0,
  zoomLevel: 1,
  slices: []
};

// keyboard event listeners.
document.addEventListener('keydown', (event) => {
  switch (event.code) {
  case 'KeyD':
    TimelineTrackState.xStart += PAN_STEP / TimelineTrackState.zoomLevel;
    TimelineTrackState.xEnd += PAN_STEP / TimelineTrackState.zoomLevel;
    break;
  case 'KeyA':
    TimelineTrackState.xStart -= PAN_STEP / TimelineTrackState.zoomLevel;
    TimelineTrackState.xEnd -= PAN_STEP / TimelineTrackState.zoomLevel;
    break;
  case 'KeyW':
    TimelineTrackState.zoomLevel *= ZOOM_STEP;
    break;
  case 'KeyS':
    TimelineTrackState.zoomLevel /= ZOOM_STEP;
    break;
  default:
    return;  // return without triggering a redraw.
  }

  // We had a switch match. Schedule a redraw.
  m.redraw();
});

const SLICE_VERTICAL_PADDING = 5;  // px
const SLICE_TEXT_PADDING = 5;  // px
const SLICE_TEXT_VERTICAL_ALIGNMENT = 6;  //px

function drawRect(ctx, x, y, w, h) {
  // Make rects not blurry.
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);

  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x + 0.5 , y + 0.5, w, h);

};

function drawText(ctx, text, x, y, maxWidth) {
  // TODO: These should be compile time / debug asserts somehow for perf.
  if (ctx.measureText(text).width > maxWidth) return;
  let height = ctx.measureText('M').width;
  ctx.save();
  ctx.fillStyle = 'black';
  ctx.fillText(text, x + SLICE_TEXT_PADDING,
               y + SLICE_TEXT_PADDING + height);
  ctx.restore();
}

function drawSlice(ctx, height, slice) {
  const x = (slice.start - TimelineTrackState.xStart)
      * TimelineTrackState.zoomLevel;
  const y = SLICE_VERTICAL_PADDING;
  const w = slice.duration * TimelineTrackState.zoomLevel;
  const h = height - SLICE_VERTICAL_PADDING;
  drawRect(ctx, x, y, w, h);
  // 3 just because it looks better than 2. Something weird here. Fix later.
  const textMaxWidth = w - 3 * SLICE_TEXT_PADDING;
  drawText(ctx, slice.name, x + SLICE_TEXT_PADDING,
               y + SLICE_TEXT_PADDING);
}

const TimelineTrack = {
  draw: function(vnode) {
    // This works because this.dom points to the first item in the dom array.
    const canvas = vnode.dom;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;

    const xStart = TimelineTrackState.xStart;
    const xEnd = xStart + canvas.width / TimelineTrackState.zoomLevel;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.fillStyle = 'ivory';
    ctx.strokeStyle = 'black';
    ctx.font= "24px sans serif";
    for (const slice of TimelineTrackState.slices) {
      if (slice.end > xStart && slice.start < xEnd) {
        drawSlice(ctx, rect.height, slice);
      }
    }
  },

  oncreate: function(vnode) {
    this.draw(vnode);
  },

  onupdate: function(vnode) {
    vnode.dom.height = vnode.dom.clientHeight;
    vnode.dom.width = vnode.dom.clientWidth;
    this.draw(vnode);
  },

  view: function() {
    return [
        m('canvas.timelineTrack'),
        m('div', `This is a timeline track. ` +
             `X offset: ${TimelineTrackState.xStart}. ` +
             `Zoom level: ${TimelineTrackState.zoomLevel}  `)];
  }
}

function CreateD3Component(element, init, render) {
  return {
    oncreate: function(vnode) {
      init(vnode.dom, vnode.attrs, vnode.state);
      render(vnode.dom, vnode.attrs, vnode.state);
    },

    onupdate: function(vnode) {
      render(vnode.dom, vnode.attrs, vnode.state);
    },

    view: function(vnode) {
      return m(element, vnode.attrs);
    },
  };
}

const Overview = CreateD3Component('svg.overview', function(node, attrs, state) {
  let rect = node.getBoundingClientRect();
  let svg = d3.select(node);
  state.margin = {top: 20, right: 20, bottom: 30, left: 0};
  let width = rect.width - state.margin.left - state.margin.right;
  let height = +svg.attr("height") - state.margin.top - state.margin.bottom;
  let g = svg.selectAll('g').data([0]);
  let g_update = g.enter().append("g").merge(g);
  state.g_update = g_update;

  let x = d3.scaleLinear();
  state.x = x;

  function brushed() {
    if (d3.event.sourceEvent && d3.event.sourceEvent.type === 'zoom')
      return;
    const s = d3.event.selection || x.range();
    const [left, right] = s.map(v => x.invert(v));
    if (TimelineTrackState.xStart === left && TimelineTrackState.xEnd === right)
      return;

    TimelineTrackState.xStart = left;
    TimelineTrackState.xEnd = right;
    m.redraw();
  }

  let brush = d3.brushX()
      .extent([[0, 0], [width, height]])
      .on("brush end", brushed);
  state.brush = brush;

  let x_axis = g_update.selectAll('.axis--x').data([0]);
  state.x_axis_update = x_axis.enter()
      .append('g').attr('class', 'axis axis--x')
      .merge(x_axis)

  let brush_selection = g_update.selectAll('.brush').data([0])

  state.brush_update = brush_selection.enter()
      .append('g')
      .attr("class", "brush")
      .call(brush).merge(brush_selection);

}, function(node, attrs, state) {
  const margin = state.margin;
  let rect = node.getBoundingClientRect();
  let svg = d3.select(node);
  let width = rect.width - margin.left - margin.right;
  let height = +svg.attr("height") - margin.top - margin.bottom;
  state.g_update.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  state.x.range([0, width]);
  if (TheTraceStore.traces.length) {
    let trace = TheTraceStore.traces[0];
    state.x.domain([trace.start(), trace.end()]);
  }
  state.x_axis_update
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(state.x));
  state.brush.extent([[0, 0], [width, height]]);
  state.brush_update.call(state.brush);

  state.brush_update.call(state.brush.move, [
      state.x(TimelineTrackState.xStart),
      state.x(TimelineTrackState.xEnd),
  ]);
});

const SidePanel = {
  view: function(vnode) {
    const open = TimelineTrackState.sidePanelDisplayed;
    const flip = () => TimelineTrackState.sidePanelDisplayed = !open;
    return m('.sidepanel',
        { class: open ? 'sidepanel-open' : 'sidepanel-closed' },
        m('button.sidepanel-button', { onclick: flip }, open ? '<' : '>'),
        m('.sidepanel-contents', open ? [
          m(FileUploader),
          m(TraceList),
        ] : undefined),
    );
  },
};

const TraceDisplay = {
  view: function(vnode) {
    if (TheTraceStore.traces.length == 0)
      return m('.loading');

    return m('div',
        {},
        m(Overview, {height: 100}),
        m(TimelineTrack),
    );
  },
};

const App = {
  view: function(vnode) {
    return m('.app',
        {},
        m(SidePanel),
        m(TraceDisplay),
    );
  }
};

let root = document.querySelector('main');
m.mount(root, App);

TheTraceStore.loadFromUrl('/examples/trace.protobuf').then(() => {
  if (TheTraceStore.traces.length === 0) return;

  const trace = TheTraceStore.traces[TheTraceStore.traces.length - 1];
  const slices = [];
  for (const slice of api.slicesForCpu(trace, 0)) {
    slices.push(slice);
  }
  TimelineTrackState.slices = slices;
  TimelineTrackState.xStart = trace.start();
  TimelineTrackState.xEnd = trace.end();

  // TODO: Remove(dproy). Useful for state debugging from devtools console.
  window.TimelineTrackState = TimelineTrackState;

  m.redraw();
});

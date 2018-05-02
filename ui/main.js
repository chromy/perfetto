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
  firstTimestamp: 0,
  lastTimestamp: 0,
  zoomLevel: 1,
  slices: []
};

// keyboard event listeners.
document.addEventListener('keydown', (event) => {
  let width = TimelineTrackState.xEnd - TimelineTrackState.xStart;
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
    TimelineTrackState.xStart += width / 100;
    TimelineTrackState.xEnd -= width / 100;
    break;
  case 'KeyS':
    TimelineTrackState.xStart -= width / 100;
    TimelineTrackState.xEnd += width / 100;
    break;
  default:
    return;  // return without triggering a redraw.
  }

  TimelineTrackState.xStart = Math.max(
      TimelineTrackState.firstTimestamp, TimelineTrackState.xStart);
  TimelineTrackState.xEnd = Math.min(
      TimelineTrackState.lastTimestamp, TimelineTrackState.xEnd);

  // We had a switch match. Schedule a redraw.
  m.redraw();
});

const SLICE_VERTICAL_PADDING = 10;  // px
const SLICE_TEXT_PADDING = 5;  // px

function drawRect(ctx, x, y, w, h) {
  // Make rects not blurry.
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);

  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x + 0.5 , y + 0.5, w, h);

};

function drawText(ctx, text, sliceX, sliceY, sliceWidth, sliceHeight) {
  const t = TheTextRenderer.fitText(text, sliceWidth - SLICE_TEXT_PADDING * 2);
  if (t === null)
    return;
  ctx.save();
  ctx.fillStyle = 'black';
  ctx.fillText(t, sliceX + SLICE_TEXT_PADDING, sliceY + (sliceHeight / 2));
  ctx.restore();
}

function drawSlice(ctx, total_height, total_width, slice) {
  let widthTime = TimelineTrackState.xEnd - TimelineTrackState.xStart;
  let d = total_width / widthTime;
  const x = (slice.start - TimelineTrackState.xStart) * d;
  const y = SLICE_VERTICAL_PADDING/2;
  const w = slice.duration * d;
  const h = total_height - SLICE_VERTICAL_PADDING;
  drawRect(ctx, x, y, w, h);
  // 3 just because it looks better than 2. Something weird here. Fix later.
  const textMaxWidth = w - 3 * SLICE_TEXT_PADDING;
  drawText(ctx, slice.name, x, y, w, h);
}

class TextRenderer {
  constructor(font) {
    this.font = font;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.textBaseline = 'middle';
    this.ctx.font = font;
    this.minimum = this.measureText('M');
    this.lengthToSize = [];
    let t = '';
    for (let i=0; i<100; i++) {
      this.lengthToSize.push(this.measureText(t));
      t += 'a';
    }
  }

  measureText(text) {
    return this.ctx.measureText(text).width;
  }

  fitText(text, width) {
    if (width < this.minimum) return null;
    if (this.lengthToSize[text.length] < width) return text;
    for (let i=text.length; i >= 4; i--) {
      if (this.lengthToSize[i] < width)
        return text.slice(0, i-3) + '...';
    }
    return null;
  }
}

const FONT_SIZE = 12 * window.devicePixelRatio;
const TheTextRenderer = new TextRenderer(`${FONT_SIZE}px sans serif`);

const TimelineTrack = {
  draw: function(vnode) {
    // This works because this.dom points to the first item in the dom array.
    const canvas = vnode.dom;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio;
    let [width, height] = [rect.width*ratio, rect.height*ratio];
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'ivory';
    ctx.strokeStyle = 'black';
    ctx.textBaseline = 'middle';
    ctx.font = TheTextRenderer.font;
    for (const slice of TimelineTrackState.slices) {
      if (slice.end > TimelineTrackState.xStart ||
          slice.start < TimelineTrackState.xEnd) {
        drawSlice(ctx, height, width, slice);
      }
    }
  },

  oncreate: function(vnode) {
    this.draw(vnode);
  },

  onupdate: function(vnode) {
    this.draw(vnode);
  },

  view: function() {
    return [
        m('canvas.timelineTrack'),
        m('div', `This is a timeline track. ` +
             `X offset: ${TimelineTrackState.xStart}.`)];
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
  state.margin = {top: 20, right: 10, bottom: 30, left: 10};
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
      .attr("transform", "translate(0," + 0 + ")")
      .call(d3.axisTop(state.x).tickFormat(v => '' + (v / 1000 / 1000) + 'ms'));
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

    return m('.tracks',
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
  for (const slice of api.slicesForCpu(trace, 6)) {
    slices.push(slice);
  }
  TimelineTrackState.slices = slices;
  TimelineTrackState.firstTimestamp = trace.start();
  TimelineTrackState.xStart = trace.start();
  TimelineTrackState.lastTimestamp = trace.end();
  TimelineTrackState.xEnd = trace.end();

  // TODO: Remove(dproy). Useful for state debugging from devtools console.
  window.TimelineTrackState = TimelineTrackState;

  m.redraw();
});

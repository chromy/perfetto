/* tslint:disable */
let d3 = require("d3");
let m = require("mithril");
let api = require("./api.js");

console.log(api.TraceConfig);
console.log(api.Trace);

function CreateD3Component(element, render) {
  return {
    oncreate: function(vnode) {
      render(vnode.dom, vnode.attrs);
    },

    onupdate: function(vnode) {
      render(vnode.dom, vnode.attrs);
    },

    view: function(vnode) {
      return m(element, vnode.attrs);
    },
  };
}

class TraceApi {
  constructor(name, protobuf) {
    this.name = name;
    this.protobuf = protobuf;
  }

  tracePacketCount() {
    return this.protobuf.packet.length;
  }
}

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
    promise.then(buffer => {
      console.info(`Finished loading ${name}`);
      this.pending.delete(promise);
      let uint8array = new Uint8Array(buffer)
      console.info(`Parsing ${name}`);
      let decoded = api.Trace.decode(uint8array);
      console.info(`Finished parsing ${name}`);
      this.traces.push(new TraceApi(name, decoded));
      m.redraw();
    });
  }

  loadFromUrl(url) {
    console.info(`Load from url ${name}`);
    fetch(url).then(r => r.blob()).then(b => this.loadFromFile(b, url));
  }

  loadFromDropEvent(e) {
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        if (e.dataTransfer.items[i].kind !== 'file')
          continue;
        this.loadFromFile(e.dataTransfer.items[i].getAsFile());
      }
    } else {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        this.loadFromFile(e.dataTransfer.files[i]);
      }
    } 
  } 
}

let TheTraceStore = new TraceStore();
TheTraceStore.loadFromUrl('/examples/trace.protobuf');

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
    }, this.dragging ? 'Drop trace file to load' : 'Drag and drop ui/trace.protobuf here');
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

const TimelineTrackState = {
  xOffset: 0,
  zoomLevel: 1
};

// keyboard event listeners.
document.addEventListener('keydown', (event) => {
  switch (event.code) {
  case 'KeyD':
    TimelineTrackState.xOffset += TimelineTrackState.zoomLevel;
    break;
  case 'KeyA':
    TimelineTrackState.xOffset -= TimelineTrackState.zoomLevel;
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

const TimelineTrack = {
  view: function() {
    return m('div.timelineTrack',
             `This is a timeline track. ` +
             `X offset: ${TimelineTrackState.xOffset}. ` +
             `Zoom level: ${TimelineTrackState.zoomLevel}  `);
  }
}

const Overview = CreateD3Component('svg.overview', function(node, attrs) {
  let rect = node.getBoundingClientRect();
  let svg = d3.select(node);
  let margin = {top: 20, right: 20, bottom: 30, left: 50};
  let width = rect.width - margin.left - margin.right;
  let height = +svg.attr("height") - margin.top - margin.bottom;
  let g = svg.selectAll('g').data([0]);
  let g_update = g.enter().append("g").merge(g);
  g_update.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  let x = d3.scaleLinear().range([0, width]);
  x.domain([0, 10000]);

  function brushed() {
    if (d3.event.sourceEvent && d3.event.sourceEvent.type === 'zoom')
      return;
    let s = d3.event.selection || x.range();
    console.log(s);
  }

  let brush = d3.brushX()
      .extent([[0, 0], [width, height]])
      .on("brush end", brushed);

  let x_axis = g_update.selectAll('.axis--x').data([0]);
  x_axis.enter()
      .append('g').attr('class', 'axis axis--x')
      .merge(x_axis)
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

  g_update.selectAll('.brush').data([0]).enter()
      .append('g')
      .attr("class", "brush")
      .call(brush)
      .call(brush.move, x.range());
});

let App = {
  view: function(vnode) {
    return m('.app-shell', {
    },
             m('h1', 'Perfetto'),
             m(FileUploader),
             m(TraceList),
             m(TimelineTrack),
             m(Overview, {height: 100}),
            );
  }
};

let root = document.querySelector('main');
m.mount(root, App);


/* tslint:disable */
let m = require("mithril");
let api = require("./api.js");

console.log(api.TraceConfig);
console.log(api.Trace);

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

  loadFromFile(file) {
    console.info(`Load from file ${file.name}`);
    let promise = new Promise((resolve, reject) => {
      let reader = new FileReader();
      reader.onload = () => resolve(reader.result); 
      reader.readAsArrayBuffer(file);
    });
    this.pending.add(promise);
    promise.then(buffer => {
      console.info(`Finished loading ${file.name}`);
      this.pending.delete(promise);
      let uint8array = new Uint8Array(buffer)
      console.info(`Parsing ${file.name}`);
      let decoded = api.Trace.decode(uint8array);
      console.info(`Finished parsing ${file.name}`);
      this.traces.push(new TraceApi(file.name, decoded));
      m.redraw();
    });
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


let App = {
  view: function(vnode) {
    return m('.app-shell', {
    },
             m('h1', 'Perfetto'),
             m(FileUploader),
             m(TraceList),
             m(TimelineTrack),
            );
  }
};

let root = document.querySelector('main');
m.mount(root, App);


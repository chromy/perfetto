import {TrackContent} from './track-content';
import {html} from 'lit-html';
import { TrackCanvasContext } from './track-canvas-controller';
import {SliceTrackContentData} from './slice-track-content-data';

export class SliceTrackContent extends TrackContent {
  //private state: TrackState | undefined;
  //private vis: TrackContent;
  static get properties() { return { data: [String] }}

  /*private * getData() {
    const slices = [,
                   ];
    for (const s of slices) {
      yield s;
    }
  }*/
  private x: (number) => number = () => 0;
  private start = 0;
  private end = 1000;
  private width = 1000;

  constructor(private tCtx: TrackCanvasContext,
              private data: SliceTrackContentData
  ) {
    super();

    //this.vis = new SliceTrackContent();
  }
  draw() {

    this.tCtx.fillStyle = 'black';
    this.tCtx.fillRect(0, 0, this.width, this.height);

    this.tCtx.fillStyle = 'pink';
    for (const slice of this.data.slices) {
      this.tCtx.fillRect(this.x(slice.start), 0,
          this.x(slice.end) - this.x(slice.start), 20);
    }

    //TODO Draw stuff with data.

    //this.vis.update(data).draw(ctx);

    /*if(true) {
      this.vis2.update(this.state).draw(s, ctx);
    }*/
  }

  setLimits(start: number, end: number)
  {
    this.start = start;
    this.end = end;

    this.x = (t: number) => {
      if(t < this.start) return 0;
      if(t > this.end) return this.width;
      return (t - this.start) / (this.end - this.start) * this.width;
    }
  }

  get height() : number {
    return 150;
  }

  _render() {

    this.draw();  // This makes it not a pure function since this is a side effect.

    return html`
    <style>
      .wrap {
        background: #fff;
        padding: 20px;
        height: ${this.height}px;
        box-sizing: border-box;
      }
      .content {
        color: #fff;
        z-index: 10;
        position: relative;
      }
    </style>
    <div class="wrap">
      <div class="content">Slice Track Content</div>
    </div>`;
  }
}

customElements.define('track-track-content', SliceTrackContent);

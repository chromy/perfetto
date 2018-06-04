import {TrackContent} from './track-content';
import {html} from 'lit-html';
import { TrackCanvasContext } from './track-canvas-controller';

export class SliceTrackContent extends TrackContent {
  //private state: TrackState | undefined;
  //private vis: TrackContent;

  private * getData() {
    const slices = [{start:   0, end:  160},
                    {start: 180, end: 260},
                    {start: 280, end: 320},
                    {start: 340, end: 360},
                    {start: 380, end: 390},
                    {start: 410, end: 415},
                    {start: 435, end: 437},
                   ];
    for (const s of slices) {
      yield s;
    }
  }

  constructor(private tCtx: TrackCanvasContext) {
    super();

    //this.vis = new SliceTrackContent();
  }
  draw() {

    const slices = this.getData();

    this.tCtx.fillStyle = 'black';
    this.tCtx.fillRect(0, 0, 1000, this.height);

    this.tCtx.fillStyle = 'pink';
    for (const slice of slices) {
      this.tCtx.fillRect(slice.start, 0, (slice.end - slice.start), 20);
    }

    //TODO Draw stuff with data.

    //this.vis.update(data).draw(ctx);

    /*if(true) {
      this.vis2.update(this.state).draw(s, ctx);
    }*/
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

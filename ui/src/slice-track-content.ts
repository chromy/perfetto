import {TrackContent} from './track-content';
import {html} from 'lit-html/lib/lit-extended';
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

  constructor(private tCtx: TrackCanvasContext,
              private data: SliceTrackContentData,
              protected width: number
  ) {
    super(width);

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



  getHeight() : number {
    return 150;
  }

  _render() {

    this.draw();  // This makes it not a pure function since this is a side effect.

    return html`
    <style>
      .wrap {
        background: #fff;
        height: ${this.height}px;
        box-sizing: border-box;
        position: relative;
        width: ${this.width}px;
      }
      .content {
        color: #fff;
        z-index: 10;
        position: absolute;
        top: 20px;
        left: 20px;
      }
    </style>
    <div class="wrap">
      ${this.eventTemplate}
      <div class="content">
        Slice Track Content
      </div>
    </div>`;
  }
}

customElements.define('trace-track-content', SliceTrackContent);

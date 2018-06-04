import {TrackContent} from './track-content';
import {html} from 'lit-html';
import { TrackCanvasContext } from './track-canvas-controller';

export class SliceTrackContent extends TrackContent {
  //private state: TrackState | undefined;
  //private vis: TrackContent;

  private * getData() {
    const slices = [{start:   0, end:  50},
                    {start: 100, end: 150},
                    {start: 200, end: 250},
                    {start: 300, end: 350},
                    {start: 400, end: 450},
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

  _render() {
    this.draw();  // This makes it not a pure function since this is a side effect.

    return html`
    <style>
      .wrap {
        background: #fff;
        padding: 20px;
      }
    </style>
    <div class="wrap">Slice Track Content</div>`;
  }
}

customElements.define('track-track-content', SliceTrackContent);

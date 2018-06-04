import {TrackContent} from './track-content';
import {html} from 'lit-html';
import { TrackCanvasContext } from './track-canvas-controller';

export class SliceTrackContent extends TrackContent {
  //private state: TrackState | undefined;
  //private vis: TrackContent;

  private * getData() {
    const slices = [{start: 10, end: 50},
                    {start: 10, end: 50},
                    {start: 10, end: 50},
                    {start: 10, end: 50},
                    {start: 10, end: 50},
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

    this.tCtx.fillStyle = 'red';
    for (const slice of slices) {
      this.tCtx.fillRect(slice.start, 0, (slice.end - slice.start), 10);
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

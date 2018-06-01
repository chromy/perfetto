import {TrackContent} from './track-content';
import {html} from 'lit-html';

export class SliceTrackContent extends TrackContent {
  //private state: TrackState | undefined;
  //private vis: TrackContent;

  private getData() {
    // TraceDataStore..
  }
  constructor() {
    super();

    //this.vis = new SliceTrackContent();
  }
  draw(ctx: CanvasRenderingContext2D) {

    this.getData();

    ctx.fillStyle = 'red';

    //TODO Draw stuff with data.

    //this.vis.update(data).draw(ctx);

    /*if(true) {
      this.vis2.update(this.state).draw(s, ctx);
    }*/
  }

  _render(ctx: CanvasRenderingContext2D) {
    this.draw(ctx);  // This makes it not a pure function since this is a side effect.

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

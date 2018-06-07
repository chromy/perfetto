import {TrackContent} from './track-content';
import {html} from 'lit-html/lib/lit-extended';
import { TrackCanvasContext } from './track-canvas-controller';
import {SliceTrackContentData} from './slice-track-content-data';

export class SliceTrackContent extends TrackContent {
  //private state: TrackState | undefined;
  //private vis: TrackContent;
  static get properties() { return { data: [String] }}

  private color: string;

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

    this.color = this.getRandomColor();

    //this.vis = new SliceTrackContent();
  }
  draw() {

    this.tCtx.fillStyle = 'black';
    this.tCtx.fillRect(0, 0, this.width, this.height);

    this.tCtx.fillStyle = '#' + this.color;
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

  private getRandomColor(): string
  {
    const alphabet = '0123456789abcdef';
    return [1,2,3,4,5,6].map(() =>
        alphabet[Math.round(Math.random()*(alphabet.length - 1))]
    ).join('');
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
        left: ${this.x(100)}px;
      }
    </style>
    <div class="wrap">
      <div class="content">
        Slice Track Content
      </div>
    </div>`;
  }
}

customElements.define('trace-track-content', SliceTrackContent);

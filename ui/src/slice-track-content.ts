import {TrackContent} from './track-content';
import {html} from 'lit-html/lib/lit-extended';
import { TrackCanvasContext } from './track-canvas-controller';
import {ThreadSlice, traceDataStore} from './trace-data-store';
import {OffsetTimeScale, Pixels} from './time-scale';
import { GlobalPositioningState } from './backend/state';

export class SliceTrackContent extends TrackContent {
  //private state: TrackState | undefined;
  //private vis: TrackContent;
  static get properties() { return { data: [String], selectedSlice: String }}

  private selectedSlice: ThreadSlice|null = null;
  private color: string;


  constructor(protected tCtx: TrackCanvasContext,
              private width: number,
              protected height: number,
              protected x: OffsetTimeScale,
              protected gps: GlobalPositioningState) {
    super(tCtx, height, x, gps);

    this.color = this.getRandomColor();
    //this.vis = new SliceTrackContent();
  }

  draw() {

    this.tCtx.fillStyle = '#f3f8fe';
    this.tCtx.fillRect(0, 0, this.width, this.height);

    this.drawGridLines();

    this.tCtx.fillStyle = '#' + this.color;
    const slices = this.getCurrentData();
    for (const slice of slices) {
      if(slice === this.selectedSlice) {
        this.tCtx.fillStyle = 'red';
      }
      const sliceWidth: Pixels = this.x.tsToPx(slice.end) - this.x.tsToPx(slice.start);
      this.tCtx.fillRect(this.x.tsToPx(slice.start), 0, sliceWidth, 20);

      let sliceText = '';
      for(let i = 0; i < slice.title.length && sliceText.length * 20 < sliceWidth; i++) {
        sliceText += slice.title[i];
      }
      if(sliceText !== slice.title) {
        sliceText += '..';
      }
      this.tCtx.fillStyle = '#000';
      this.tCtx.fillText(sliceText, this.x.tsToPx(slice.start), 15);

      this.tCtx.fillStyle = '#' + this.color;
    }
  }

  private getCurrentData() {
    return traceDataStore.getData({
      start: this.gps.startVisibleWindow,
      end: this.gps.endVisibleWindow,
      process: 1,
      thread: 1,
    });
  }

  private getRandomColor(): string
  {
    return this.getRandomString(6, '0123456789abcdef');
  }

  private getRandomString(length: number,
                          alphabet: string = 'abcdefghijklmnopqrstuvwxzy') {
    return new Array(length).fill(0).map(() =>
        alphabet[Math.round(Math.random()*(alphabet.length - 1))]
      ).join('');
  }

  getHeight() : number {
    return 100;
  }

  onClick(e: MouseEvent) {
    if(e.target) {
      const eventTarget: HTMLElement = <HTMLElement> e.target;
      const bcr = <DOMRect> eventTarget.getBoundingClientRect();
      const rel = { x: e.clientX - bcr.x, y: e.clientY - bcr.y };
      let deselect = true;

      if(rel.y >= 0 && rel.y <= 20) {
        const t = this.x.pxToTs(rel.x);
        const slices = this.getCurrentData();

        for (const slice of slices) {
          if(slice.start < t && slice.end > t && slice !== this.selectedSlice) {
            this.selectedSlice = slice;
            deselect = false;
          }
        }
      }
      else {
        deselect = true;
      }

      if(deselect) {
        this.selectedSlice = null;
      }

    }
  }

  _render() {

    this.draw();  // This makes it not a pure function since this is a side effect.

    return html`
    <style>
      .wrap {
        background: #f3f8fe;
        height: ${this.height}px;
        box-sizing: border-box;
        position: relative;
        width: ${this.width}px;
      }
      .content {
        z-index: 10;
        position: absolute;
        top: 20px;
        left: ${this.x.tsToPx(100)}px;
      }
      .markers .marker {
        position: absolute;
        z-index: 10;
        top: 80px;
      }
      .markers .indicator {
        background: #f00;
        width: 1px;
        height: 20px;
      }
      .markers .label {
        position: absolute;
        color: #fff;
        top: -20px;
        left: 0;
      }
    </style>
    <div class="wrap" on-click=${(e: MouseEvent) => { this.onClick(e);}}>
      <div class="content">
        Slice Track Content
      </div>
    </div>`;
  }
}

customElements.define('trace-track-content', SliceTrackContent);

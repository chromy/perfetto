import {TrackContent} from './track-content';
import {html} from 'lit-html/lib/lit-extended';
import { TrackCanvasContext } from './track-canvas-controller';
import {OffsetTimeScale, Pixels} from './time-scale';
import { GlobalPositioningState, TrackSlice, TrackData, TrackState } from './backend/state';
import { traceDataStore } from './trace-data-store';
import uiDispatcher from './frontend/ui-dispatcher';

// TODO: Think about whether UI state store should be directly accessed by a
// web component.
import uiStateStore from './frontend/ui-state-store';

// TODO: We might need a smarter way to address slices.
function updateSliceSelection(slice: TrackSlice | null) {
  return {
    topic: 'update_slice_selection',
    slice,
  }
}

export class SliceTrackContent extends TrackContent {
  static get properties() { return { data: [String], selectedSlice: String }}

  private letterWidth: number|null = null;

  constructor(protected tCtx: TrackCanvasContext,
              protected width: number,
              protected height: number,
              protected x: OffsetTimeScale,
              protected gps: GlobalPositioningState,
              trackData: TrackData | undefined,
              trackState: TrackState) {
    super(tCtx, width, height, x, gps, trackData, trackState);
  }

  draw() {
    if (!this.letterWidth)
      this.letterWidth = this.tCtx.measureText('0').width;

    this.tCtx.fillStyle = '#f3f8fe';
    this.tCtx.fillRect(0, 0, this.width, this.height);
    const selectedSliceId = uiStateStore.gState.selection ?
        uiStateStore.gState.selection.id : '';

    this.drawGridLines();

    const slices = this.getCurrentData();
    for (const slice of slices) {
      if (slice.id === selectedSliceId) {
        this.tCtx.fillStyle = 'red';
      } else if (slice.color) {
        this.tCtx.fillStyle = slice.color;
      } else {
        this.tCtx.fillStyle = 'pink';
      }
      const sliceWidth: Pixels = this.x.tsToPx(slice.end) - this.x.tsToPx(slice.start);
      this.tCtx.fillRect(this.x.tsToPx(slice.start), 0, sliceWidth, 20);

      let sliceText = null;
      const numLetters = Math.floor((sliceWidth-20) / this.letterWidth);
      // Three cases:
      if (slice.title.length <= numLetters) {
        // Whole text fits.
        sliceText = slice.title;
      } else if (numLetters >= 6) {
        // Fit at least three chars + ...
        sliceText = slice.title.slice(0, numLetters - 3) + '...';
      } else {
        // No text fits.
        continue;
      }

      this.tCtx.fillStyle = '#000';
      this.tCtx.fillText(sliceText, this.x.tsToPx(slice.start), 15);
    }
  }

  private getCurrentData() {
    if (this.trackData) return this.trackData.data;

    // This code path is only for mock data now.
    // TODO: Get proper process/thread instead of this giant hack.
    const process = parseInt(this.trackState.id.substring(3));
    const thread = parseInt(this.trackState.id.substring(3));

    return traceDataStore.getData({
      start: this.gps.startVisibleWindow,
      end: this.gps.endVisibleWindow,
      process,
      thread,
    });
  }

  getHeight() : number {
    return 100;
  }

  public setWidth(width: number) {
    this.width = width;
  }

  onClick(e: MouseEvent) {
    if(e.target) {
      const eventTarget: HTMLElement = <HTMLElement> e.target;
      const bcr = <DOMRect> eventTarget.getBoundingClientRect();
      const rel = { x: e.clientX - bcr.x, y: e.clientY - bcr.y };
      let deselect = true;
      const selectedSliceId = uiStateStore.gState.selection ?
          uiStateStore.gState.selection.id : '';

      if(rel.y >= 0 && rel.y <= 20) {
        const t = this.x.pxToTs(rel.x);
        const slices = this.getCurrentData();

        for (const slice of slices) {
          if(slice.start < t && slice.end > t
              && slice.id !== selectedSliceId) {
            this.selectSlice(slice);
            deselect = false;
          }
        }
      }
      else {
        deselect = true;
      }

      if(deselect) {
        this.deselectSlice();
      }
    }
  }

  private selectSlice(slice: TrackSlice) {
    uiDispatcher.gDispatch(updateSliceSelection(slice));
  }

  private deselectSlice() {
    uiDispatcher.gDispatch(updateSliceSelection(null));
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

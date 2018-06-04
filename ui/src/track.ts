import {LitElement, html} from '@polymer/lit-element';
import {State, TrackState} from './state';
import {TrackShell} from './track-shell';
import {SliceTrackContent} from './slice-track-content';
import {TrackContent} from './track-content';
import { TrackCanvasContext } from './track-canvas-controller';
import {TrackContentData} from './track-content-data';

export class Track extends LitElement {
  shell: TrackShell;
  content: TrackContent;
  type: string; //? Class? something;
  trackContentData: TrackContentData;

  constructor(private state: TrackState,
              private globalState: State,
              private tCtx: TrackCanvasContext)
  {
    super();

    const cp = this.contentPosition;
    const contentCtx = new TrackCanvasContext(this.tCtx, cp.left, cp.top);

    this.type = 'slice'; //TODO: Infer
    this.trackContentData = {
      trace: 'abc',
      thread: 'def',
      process: 'ghi',
      slices: [{start:   0, end:  160},
        {start: 180, end: 260},
        {start: 280, end: 320},
        {start: 340, end: 360},
        {start: 380, end: 390},
        {start: 410, end: 415},
        {start: 435, end: 437}]
    };
    this.content = new SliceTrackContent(contentCtx, this.trackContentData); //TODO: Infer

    this.shell = new TrackShell(this.content.height);
  }

  get height() {
    return this.contentPosition.top + this.content.height + this.contentPosition.bottom;
  }

  get contentPosition() : { top: number, right: number, bottom: number, left: number } {
    return { top: 92, right: 0, bottom: 20, left: 220 };
  }

  _render() {
    //const TrackContentClass = getTrackContentClass(this.type);
    console.log('rendering track', this.state, this.globalState.gps, this.type);

    return html`
    
    <style>
      .wrap {
        background: orange;
        padding: 20px;
        height: ${this.height}px;
        box-sizing: border-box;
        position: relative;
      }
      .content {
        position: absolute;
        top: ${this.contentPosition.top}px;
        left: ${this.contentPosition.left}px;
        width: 1000px;
      }
    </style>
    
    <div class="wrap">
      <h2>Track</h2>
      ${this.shell}
      <div class="content">
        ${this.content}
      </div>
    </div>`;
  }
}

customElements.define('trace-track', Track);

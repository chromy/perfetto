import {LitElement, html} from '@polymer/lit-element';
import {TrackState} from './state';
import {TrackShell} from './track-shell';
import {SliceTrackContent} from './slice-track-content';
import {TrackContent} from './track-content';
import { TrackCanvasContext } from './track-canvas-controller';

export class Track extends LitElement {
  shell: TrackShell;
  content: TrackContent;
  type: string; //? Class? something;
  trackContentData: TrackContentData;
  state: TrackState;

  get height() {
    return 233;
  }

  constructor(s: TrackState, private tCtx: TrackCanvasContext)
  {
    super();

    this.state = s;
    this.shell = new TrackShell();
    const contentCtx = new TrackCanvasContext(this.tCtx, 20, this.selfHeightTop);
    this.content = new SliceTrackContent(contentCtx); //TODO: Infer
    this.type = 'slice'; //TODO: Infer
    this.trackContentData = {
      trace: 'abc',
      thread: 'def',
      process: 'ghi'
    };
  }

  get selfHeightTop() : number {
    return 152;
  }

  _render() {
    //const TrackContentClass = getTrackContentClass(this.type);
    return html`
    
    <style>
      .wrap {
        background: orange;
        padding: 20px;
      }
    </style>
    
    <div class="wrap">
      <h2>Track</h2>
      ${this.shell}
      ${this.content}
    </div>`;
  }
}

customElements.define('trace-track', Track);

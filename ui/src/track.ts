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
    return -1;
  }

  constructor(s: TrackState, private tCtx: TrackCanvasContext)
  {
    super();

    this.state = s;
    this.shell = new TrackShell();
    this.content = new SliceTrackContent(this.tCtx); //TODO: Infer
    this.type = 'slice'; //TODO: Infer
    this.trackContentData = {
      trace: 'abc',
      thread: 'def',
      process: 'ghi'
    };
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

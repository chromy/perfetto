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

  constructor(s: TrackState, private tCtx: TrackCanvasContext)
  {
    super();

    this.state = s;

    const cp = this.contentPosition;
    const contentCtx = new TrackCanvasContext(this.tCtx, cp.left, cp.top);
    this.content = new SliceTrackContent(contentCtx); //TODO: Infer
    this.type = 'slice'; //TODO: Infer
    this.trackContentData = {
      trace: 'abc',
      thread: 'def',
      process: 'ghi'
    };

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

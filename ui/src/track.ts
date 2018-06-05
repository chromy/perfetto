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

  private shellWidth = 200;

  constructor(private state: TrackState,
              private globalState: State,
              private tCtx: TrackCanvasContext,
              private width: number)
  {
    super();

    const cp = this.contentPosition;
    const contentCtx = new TrackCanvasContext(this.tCtx, cp.left + this.shellWidth, cp.top);

    this.type = 'slice'; //TODO: Infer
    this.trackContentData = {
      trace: 'abc',
      thread: 'def',
      process: 'ghi',
      slices: this.getMockSlices()
    };

    const contentWidth = this.width - this.shellWidth -
        this.contentPosition.left - this.contentPosition.right;
    this.content = new SliceTrackContent(contentCtx, this.trackContentData, contentWidth); //TODO: Infer
    this.shell = new TrackShell(this.content.height, this.shellWidth);
  }

  getMockSlices()
  {
    const mocks: {start: number, end: number}[] = [];
    let nextStart = 0;

    for(let t = 0; t <= 250; t += 1)
    {
      const mock = {start: nextStart, end: nextStart + Math.round(Math.abs(Math.sin(t)*50))};
      mocks.push(mock);
      nextStart = mock.end + Math.round(Math.abs(Math.sin(t)*20));
    }
    return mocks;
  }

  get height() {
    return this.contentPosition.top + this.content.height + this.contentPosition.bottom;
  }

  get contentPosition() : { top: number, right: number, bottom: number, left: number } {
    return { top: 92, right: 20, bottom: 20, left: 20 };
  }

  _render() {

    if(this.state)
    {
      // This is here just so this.state is used.
    }

    this.content.setLimits(this.globalState.gps.startVisibleWindow,
        this.globalState.gps.endVisibleWindow);

    this.content._invalidateProperties();

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
        width: ${this.width - 
    this.contentPosition.left - this.contentPosition.right + 'px'};
      }
      .trackcontent {
        position: absolute;
        top: 0px;
        left: ${this.shellWidth + 'px'};
        width: ${this.width - this.shellWidth -
    this.contentPosition.left - this.contentPosition.right + 'px'};
      }
      }
    </style>
    
    <div class="wrap">
      <h2>Track</h2>
      
      <div class="content">
        ${this.shell}
        <div class="trackcontent">
          ${this.content}
        </div>
      </div>
    </div>`;
  }
}

customElements.define('trace-track', Track);

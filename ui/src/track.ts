import {LitElement, html} from '@polymer/lit-element';
import {TrackState} from './state';
import {TrackShell} from './track-shell';
import {SliceTrackContent} from './slice-track-content';
import {TrackContent} from './track-content';
import { TrackCanvasContext } from './track-canvas-controller';
import {OffsetTimeScale} from './time-scale';

export class Track extends LitElement {
  shell: TrackShell;
  content: TrackContent;
  type: string; //? Class? something;

  private shellWidth = 200;

  constructor(private state: TrackState,
              private tCtx: TrackCanvasContext,
              private width: number,
              private x: OffsetTimeScale)
  {
    super();

    const cp = this.contentPosition;
    const contentCtx = new TrackCanvasContext(this.tCtx, cp.left + this.shellWidth, cp.top);

    this.type = 'slice'; //TODO: Infer
    
    const contentWidth = this.width - this.shellWidth -
        this.contentPosition.left - this.contentPosition.right;
    const contentX = new OffsetTimeScale(this.x,
        this.contentPosition.left,
        contentWidth);
    this.content = new SliceTrackContent(contentCtx, contentWidth, contentX); //TODO: Infer
    this.shell = new TrackShell(this.content.height, this.shellWidth, this.state.metadata.name);

    //console.log(this.width, this.height);
    contentCtx.setDimensions(this.width, this.height);
  }

  get height() {
    return this.contentPosition.top + this.content.height + this.contentPosition.bottom;
  }

  get contentPosition() : { top: number, right: number, bottom: number, left: number } {
    return { top: 10, right: 0, bottom: 0, left: 10 };
  }

  _render() {

    if(this.state) {
      // This is here just so this.state is used.
    }

    this.content._invalidateProperties();

    //this.eventTemplate.innerHTML = this.content;

    return html`
    <style>
      .wrap {
        background-color: hsl(217, 100%, 98%);
        padding: 2px;
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

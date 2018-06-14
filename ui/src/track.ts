import {LitElement, html} from '@polymer/lit-element';
import {TrackState, GlobalPositioningState} from './backend/state';
import {TrackShell} from './track-shell';
import {SliceTrackContent} from './slice-track-content';
import {TrackContent} from './track-content';
import { TrackCanvasContext } from './track-canvas-controller';
import {OffsetTimeScale} from './time-scale';
import {render} from 'lit-html';

export class Track extends LitElement {
  shell: TrackShell;
  content: TrackContent;
  type: string; //? Class? something;

  constructor(private state: TrackState,
              private tCtx: TrackCanvasContext,
              private width: number,
              private x: OffsetTimeScale,
              private gps: GlobalPositioningState)
  {
    super();

    this.type = 'slice'; //TODO: Infer
    const height = 100;

    this.shell = new TrackShell(height, this.width, this.state.metadata.name);
    const contentWidth = this.shell.getContentWidth();

    const cp = this.contentPosition;
    const shellCp = this.shell.contentPosition;
    const left = cp.left + shellCp.left;
    const top = cp.top + shellCp.top;

    const contentX = new OffsetTimeScale(this.x, left, contentWidth);
    const contentCtx = new TrackCanvasContext(this.tCtx, left, top);
    this.content = new SliceTrackContent(contentCtx, contentWidth, contentX, this.gps); //TODO: Infer

    //console.log(this.width, this.height);
    contentCtx.setDimensions(this.width, this.height);
  }

  public setState(state: TrackState, gps: GlobalPositioningState) {
    this.state = state;
    this.gps = gps;

    this.content.setGps(gps);
  }

  get contentPosition() : { top: number, right: number, bottom: number, left: number } {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  get height() {
    const cp = this.contentPosition;
    return cp.top + cp.bottom + this.content.height;
  }

  _render() {
    this.content._invalidateProperties();

    const contentTemplate = html`${this.content}`;
    render(contentTemplate, this.shell);

    return html`
    <style>
    :host {
      height: ${this.height}px;
      width: ${this.width}px;
      display: block;
      box-sizing: border-box;
      position: relative;
    }
    .wrap {
      position: absolute;
      top: ${this.contentPosition.top}px;
      left: ${this.contentPosition.left}px;
    }
    </style>
    <div class="wrap">
      ${this.shell}
    </div>`;
  }
}

customElements.define('trace-track', Track);

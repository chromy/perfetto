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
  public height: number;

  constructor(private state: TrackState,
              private tCtx: TrackCanvasContext,
              private width: number,
              private x: OffsetTimeScale,
              private gps: GlobalPositioningState)
  {
    super();

    this.type = 'slice'; //TODO: Infer
    this.height = this.state.height;

    this.shell = new TrackShell(this.height, this.width, this.state.name);
    const contentWidth = this.shell.getContentWidth();

    const shellCp = this.shell.contentPosition;
    const contentX = new OffsetTimeScale(this.x, shellCp.left, contentWidth);
    const contentCtx = new TrackCanvasContext(this.tCtx, shellCp.left, shellCp.top);
    const contentHeight = this.height - shellCp.top - shellCp.bottom;

    this.content = new SliceTrackContent(contentCtx, contentWidth,
        contentHeight, contentX, this.gps); //TODO: Infer
    contentCtx.setDimensions(this.width, contentHeight);
  }

  public setState(state: TrackState, gps: GlobalPositioningState) {
    this.state = state;
    this.gps = gps;

    this.content.setGps(gps);
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
      position: relative;
    }
    </style>
    <div class="wrap">
      ${this.shell}
    </div>`;
  }
}

customElements.define('trace-track', Track);

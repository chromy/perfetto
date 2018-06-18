import {LitElement, html} from '@polymer/lit-element';
import {TrackState, GlobalPositioningState, TrackData} from './backend/state';
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
  private contentCtx: TrackCanvasContext;
  private contentX: OffsetTimeScale;

  constructor(private state: TrackState,
              private tCtx: TrackCanvasContext,
              private width: number,
              private x: OffsetTimeScale,
              private gps: GlobalPositioningState,
              private trackData: TrackData | undefined)
  {
    super();

    this.type = 'slice'; //TODO: Infer
    this.height = this.state.height;

    this.shell = new TrackShell(this.height, this.width, this.state.name);
    const contentWidth = this.shell.getContentWidth();

    const shellCp = this.shell.contentPosition;
    this.contentX = new OffsetTimeScale(this.x, shellCp.left, contentWidth);
    this.contentCtx = new TrackCanvasContext(this.tCtx, shellCp.left, shellCp.top);
    const contentHeight = this.getContentHeight();

    this.content = new SliceTrackContent(this.contentCtx, contentWidth,
        contentHeight, this.contentX, this.gps, this.trackData, this.state); //TODO: Infer
    this.contentCtx.setDimensions(this.width, contentHeight);
  }

  public setState(state: TrackState, gps: GlobalPositioningState,
      trackData: TrackData | undefined) {
    this.state = state;
    this.gps = gps;
    this.trackData = trackData;

    this.content.setState(this.gps, this.trackData, this.state);
  }

  public setWidth(width: number, scale: OffsetTimeScale) {
    //TODO: Too much code duplication with constructor.
    this.width = width;
    this.x = scale;
    this.shell.setWidth(width);
    const contentHeight = this.getContentHeight();
    const contentWidth = this.shell.getContentWidth();
    const shellCp = this.shell.contentPosition;
    this.contentX = new OffsetTimeScale(this.x, shellCp.left, contentWidth);
    this.content.setWidth(contentWidth);
    this.contentCtx.setDimensions(this.width, contentHeight);
  }

  private getContentHeight(): number {
    const shellCp = this.shell.contentPosition;
    return this.height - shellCp.top - shellCp.bottom;
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

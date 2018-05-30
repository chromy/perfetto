import {LitElement, html} from '@polymer/lit-element';
import {TrackState} from './state';

export class Track extends LitElement {
  shell: TrackShell;
  content: TrackContent;
  type: string; //? Class? something;
  trackContentData: TrackContentData;
  s: TrackState | undefined;

  get height() {
    return -1;
  }
  set context(context: CanvasRenderingContext2D) {
    this.ctx = context;
  }

  set state(state: TrackState) {
    this.s = state;
  }

  constructor(state?: TrackState)
  {
    super();

    if(state)
    {
      this.state = state;
    }

    this.shell = new TrackShell();
    this.content = new SliceTrackContent(); //TODO: Infer
    this.type = 'slice'; //TODO: Infer
    this.trackContentData = {
      trace: 'abc',
      thread: 'def',
      process: 'ghi'
    };
  }

  render() {
    //const TrackContentClass = getTrackContentClass(this.type);
    return html`<div>
      <TrackShell name="test" />
      <TrackContentClass data="trackContentData" />
    </div>`;
  }
}



customElements.define('trace-track', Track);

import {LitElement, html} from '@polymer/lit-element';
import {TrackTreeState} from './state';

export class Track extends LitElement {
  shell: TrackShell;
  content: TrackContent;
  type: string; //? Class? something;
  trackContentData: TrackContentData;
  s: TrackTreeState | undefined;

  get height() {
    return -1;
  }
  set context(context: CanvasRenderingContext2D) {
    this.ctx = context;
  }

  set state(state: TrackTreeState) {
    this.s = state;
  }

  constructor()
  {
    super();

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

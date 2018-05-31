import {LitElement, html} from '@polymer/lit-element';
import {TrackState} from './state';

export class Track extends LitElement {
  shell: TrackShell;
  content: TrackContent;
  type: string; //? Class? something;
  trackContentData: TrackContentData;
  state: TrackState;

  get height() {
    return -1;
  }

  constructor(s: TrackState)
  {
    super();

    this.state = s;
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
      ${this.shell}
      ${this.content}
    </div>`;
  }
}



customElements.define('trace-track', Track);

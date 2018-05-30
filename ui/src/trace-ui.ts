import {LitElement, html} from '@polymer/lit-element';
import {TrackCanvasController} from './track-canvas-controller';
import {State} from './state';

export class TraceUi extends LitElement {

  static get properties() { return { s: String }}

  private cc: TrackCanvasController;
  private s: State | undefined;

  set state(state: State)
  {
    this.s = state;
  }

  constructor()
  {
    super();
    console.log('Trace UI initialized.');
    this.cc = new TrackCanvasController();
  }

  _render() {
    if(!this.s)
    {
      throw new Error('State not defined!');
    }

    console.log('Rendering Trace UI.');

    return html`<div id='ui' style="border: 1px solid #999;"><h1>Trace UI</h1>
      <global-brush-timeline></global-brush-timeline>
      <track-tree id="root-track-tree" state=${this.s.trackTree} context=${this.cc.getContext2D()}></track-tree>
    </div>`;
    //<track-tree tree=rootTree modifiedCtx=cc.getCanvasContext('2D')/>
  }

}

customElements.define('trace-ui', TraceUi);
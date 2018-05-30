import {LitElement, html} from '@polymer/lit-element';
import {TrackTree} from './track-tree';
import {TrackCanvasController} from './track-canvas-controller';

export class TraceUi extends LitElement {

  static get properties() { return { mood: String }}

  private cc: TrackCanvasController;
  private state: State | undefined;

  constructor()
  {
    super();
    console.log('Trace UI initialized.');
    this.cc = new TrackCanvasController();
  }

  _render() {
    if(!this.state)
    {
      throw new Error('State not defined!');
    }

    const trackTree: TrackTree = new TrackTree(); //document.getElementsByTagName('track-tree')[0]; // = document.get...
    trackTree.state = this.state.trackTree; // Root tree
    trackTree.context = this.cc.getContext2D();

    return html`<div id='ui'>
      <global-brush-timeline />
      <track-tree/>
    </div>`;
    //<track-tree tree=rootTree modifiedCtx=cc.getCanvasContext('2D')/>
  }

}

customElements.define('trace-ui', TraceUi);
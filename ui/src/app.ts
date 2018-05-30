import {LitElement, html} from '@polymer/lit-element';
import {TrackTree} from './track-tree';

class TraceUi extends LitElement {

  static get properties() { return { mood: String }}

  private cc: TrackCanvasController;

  constructor(private state: State)
  {
    super();
    this.cc = new TrackCanvasController();
  }

  _render() {
    //const trackTree: TrackTree = document.getElementsByTagName('track-tree')[0]; // = document.get...
    //trackTree.state = this.state.trackTree; // Root tree
    //trackTree.context = this.cc.getContext2D();

    return html`<div id='ui'>
      <global-brush-timeline />
      <track-tree/>
    </div>`;
    //<track-tree tree=rootTree modifiedCtx=cc.getCanvasContext('2D')/>
  }

}

customElements.define('trace-ui', TraceUi);
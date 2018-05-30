import {LitElement, html} from '@polymer/lit-element';
import {TrackTree} from './track-tree';
import {TrackCanvasController} from './track-canvas-controller';
import {State} from './state';
import {GlobalBrushTimeline} from './global-brush-timeline';

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
    const trackTree: TrackTree = new TrackTree(); //document.getElementsByTagName('track-tree')[0]; // = document.get...
    trackTree.state = this.s.trackTree; // Root tree
    trackTree.context = this.cc.getContext2D();

    // Just doing this so the file is included in the build..
    if({} instanceof GlobalBrushTimeline)
    {

    }

    return html`<div id='ui'><h1>Trace UI</h1>
      <global-brush-timeline></global-brush-timeline>
      <track-tree></track-tree>
    </div>`;
    //<track-tree tree=rootTree modifiedCtx=cc.getCanvasContext('2D')/>
  }

}

customElements.define('trace-ui', TraceUi);
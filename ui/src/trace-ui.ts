import {LitElement, html} from '@polymer/lit-element';
import {TrackCanvasController} from './track-canvas-controller';
import {State} from './state';
import {GlobalBrushTimeline} from './overview-timeline/global-brush-timeline';
import {TrackTree} from './track-tree';

export class TraceUi extends LitElement {

  static get properties() { return { s: String }}

  private cc: TrackCanvasController;
  private overview: GlobalBrushTimeline;
  private root: TrackTree;

  constructor(private state: State)
  {
    super();
    console.log('Trace UI initialized.');

    this.cc = new TrackCanvasController();

    this.overview = new GlobalBrushTimeline(this.state);
    this.root = new TrackTree(this.state.trackTree, this.cc.getContext2D());
  }

  _render() {
    console.log('Rendering Trace UI.');

    return html`<div id='ui' style="border: 1px solid #999;"><h1>Trace UI</h1>
      ${this.overview}
      ${this.root}
    </div>`;
    //<track-tree tree=rootTree modifiedCtx=cc.getCanvasContext('2D')/>
  }

}

customElements.define('trace-ui', TraceUi);
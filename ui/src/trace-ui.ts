import {LitElement, html} from '@polymer/lit-element';
import { CanvasController, TrackCanvasContext} from './track-canvas-controller';
import {State} from './state';
import {GlobalBrushTimeline} from './overview-timeline/global-brush-timeline';
import {TrackTree} from './track-tree';

export class TraceUi extends LitElement {

  static get properties() { return { s: String }}

  private cc: CanvasController;
  private overview: GlobalBrushTimeline;
  private root: TrackTree;

  constructor(private state: State)
  {
    super();
    console.log('Trace UI initialized.');

    this.cc = new CanvasController();

    this.overview = new GlobalBrushTimeline(this.state);
    const tCtx = new TrackCanvasContext(this.cc.getContext2D(), 0, 0);
    this.root = new TrackTree(this.state.trackTree, tCtx);
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

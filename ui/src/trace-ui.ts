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
    const tCtx = new TrackCanvasContext(this.cc.getContext2D(), 0, 0);
    this.root = new TrackTree(this.state.trackTree, this.state, tCtx);

    this.overview = new GlobalBrushTimeline(this.state, () => {
      this.root._invalidateProperties();
    });
  }

  _render() {
    console.log('Rendering Trace UI.');

    return html`
    <style>
      .ui {
        border: 1px solid #999;
      }
      .tracks-list {
        position: relative;
      }
    </style>
    <div id='ui' class="ui">
      <h1>Trace UI</h1>
      ${this.overview}
      <div class="tracks-list">
        ${this.root}
        ${this.cc}
      </div>
    </div>`;
    //<track-tree tree=rootTree modifiedCtx=cc.getCanvasContext('2D')/>
  }

}

customElements.define('trace-ui', TraceUi);

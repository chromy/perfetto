import {LitElement, html} from '@polymer/lit-element';
import { CanvasController } from './track-canvas-controller';
import {State} from './state';
import {GlobalBrushTimeline} from './overview-timeline/global-brush-timeline';
import {TrackTree} from './track-tree';
import {PanContent} from './pan-content';
import {render} from 'lit-html';

export class TraceUi extends LitElement {

  static get properties() { return { s: String }}

  private cc: CanvasController;
  private overview: GlobalBrushTimeline;
  private root: TrackTree;
  private pc: PanContent;

  constructor(private state: State, private width: number)
  {
    super();
    console.log('Trace UI initialized.', this.width);

    const reRender = () => this._invalidateProperties();

    const canvasHeight = 2 * window.innerHeight;
    this.cc = new CanvasController(this.width, canvasHeight, window.innerHeight, reRender);
    const tCtx = this.cc.getTrackCanvasContext();
    this.root = new TrackTree(this.state.trackTree, this.state, tCtx, this.width);

    this.overview = new GlobalBrushTimeline(this.state, this.width, reRender);
    this.pc = new PanContent(this.width, this.root.height, this.state, reRender);
  }

  _render() {
    this.overview._invalidateProperties();
    this.root._invalidateProperties();
    this.pc._invalidateProperties();

    const panContentContent = html`
        ${this.root}
        ${this.cc}
    `;

    render(panContentContent, this.pc);

    return html`
    <style>
      .ui {
        /*border: 1px solid #999;*/
        position: relative;
      }
      .tracks-list {
        position: relative;
      }
    </style>
    
    <div id='ui' class="ui">
      <h1>Trace UI</h1>
      ${this.overview}
      <div class="tracks-list">
        ${this.pc}
      </div>
    </div>`;
    //<track-tree tree=rootTree modifiedCtx=cc.getCanvasContext('2D')/>
  }

}

customElements.define('trace-ui', TraceUi);

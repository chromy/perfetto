import {LitElement, html} from '@polymer/lit-element';
import {CanvasController, TrackCanvasContext} from './track-canvas-controller';
import {State} from './backend/state';
import {GlobalBrushTimeline} from './overview-timeline/global-brush-timeline';
import {TrackTree} from './track-tree';
import {PanContent} from './pan-content';
import {render} from 'lit-html';
import {OffsetTimeScale, TimeScale} from './time-scale';
import {DetailAxis} from './detail-axis';

export class TraceUi extends LitElement {

  static SCROLLBAR_WIDTH = 16;
  static CONTENT_MARGIN_LEFT = 200;
  static AXIS_HEIGHT = 50;

  static get properties() { return { s: String }}

  private cc: CanvasController;
  private overview: GlobalBrushTimeline;
  private root: TrackTree;
  private pc: PanContent;
  //private overviewScale: TimeScale;
  private scale: TimeScale;
  private detailAxis: DetailAxis;

  constructor(private state: State, private width: number,
              private height: number) {
    super();
    console.log('Trace UI initialized.', this.width);

    const reRender = () => this._invalidateProperties();

    const canvasHeight = 2 * this.height;

    this.scale = new TimeScale(0, 1000, TraceUi.CONTENT_MARGIN_LEFT,
        this.width);

    this.cc = new CanvasController(this.width, canvasHeight, this.height, reRender);
    const tCtx = this.cc.getTrackCanvasContext();

    const tracksCtx = new TrackCanvasContext(tCtx, 0, TraceUi.AXIS_HEIGHT);
    const contentWidth = this.width - TraceUi.SCROLLBAR_WIDTH;
    this.root = new TrackTree(this.state.trackTree, tracksCtx,
        contentWidth, new OffsetTimeScale(this.scale,0, this.width));
    this.overview = new GlobalBrushTimeline(this.state, contentWidth, reRender);
    //const totalHeight = this.overview.height + this.root.height;
    this.pc = new PanContent(this.width,
        this.height,
        this.state,
        this.scale,
        reRender,
        (scrollTop: number) => this.cc.setScrollTop(scrollTop)
        );
    this.cc.setMaxHeight(this.root.height);
    this.detailAxis = new DetailAxis(tCtx, this.width, TraceUi.AXIS_HEIGHT, this.scale);
  }

  _render() {

    this.scale.setTimeLimits(this.state.gps.startVisibleWindow,
        this.state.gps.endVisibleWindow);

    this.overview._invalidateProperties();
    this.root._invalidateProperties();
    this.pc._invalidateProperties();
    this.detailAxis.render();

    const panContentContent = html`
        
      <style>
      :host {
        display: block;
      }
      .ui , .content {
        position: relative;
      }
      .tracks-list {
        position: relative;
        top: ${TraceUi.AXIS_HEIGHT}px
      }
    </style>
    
    <div id='ui' class="ui">
      <h1>Trace UI</h1>
      ${this.overview}
      <div class="content">
        <div class="tracks-list">
          ${this.root}
        </div>
        ${this.cc}
      </div>
    </div>
    `;

    render(panContentContent, this.pc);

    return html`
    ${this.pc}
    `;
  }

}

customElements.define('trace-ui', TraceUi);

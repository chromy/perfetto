import {LitElement, html} from '@polymer/lit-element';
import {CanvasController, TrackCanvasContext} from './track-canvas-controller';
import {State} from './backend/state';
import {GlobalBrushTimeline} from './overview-timeline/global-brush-timeline';
import {TrackTree} from './track-tree';
import {PanContent} from './pan-content';
import {render} from 'lit-html';
import {OffsetTimeScale, TimeScale} from './time-scale';
import {DetailAxis} from './detail-axis';
import {SideDetailPanel} from './slice-detail-panel';

export class TraceUi extends LitElement {

  static SCROLLBAR_WIDTH = 16;
  static CONTENT_MARGIN_LEFT = 200;
  static AXIS_HEIGHT = 50;

  static get properties() { return { s: String }}

  private cc: CanvasController;
  private overview: GlobalBrushTimeline;
  private root: TrackTree | null;
  private pc: PanContent;
  //private overviewScale: TimeScale;
  private scale: TimeScale;
  private detailAxis: DetailAxis;
  private detailPanel: SideDetailPanel;

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

    const contentWidth = this.width - TraceUi.SCROLLBAR_WIDTH;
    // TODO: This constructor has too many arguments. Need better state propagation.
    this.root = this.state.rootTrackTree != null
      ? this.root = this.createRootTree(this.state.rootTrackTree)
      : null;

    this.overview = new GlobalBrushTimeline(this.state, contentWidth, reRender);
    //const totalHeight = this.overview.height + this.root.height;
    this.pc = new PanContent(this.width,
        this.height,
        this.state,
        this.scale,
        reRender,
        (scrollTop: number) => this.cc.setScrollTop(scrollTop)
        );
    const canvasMaxHeight = !this.root ? 0 :
        this.root.height + TraceUi.AXIS_HEIGHT;
    this.cc.setMaxHeight(canvasMaxHeight);
    this.detailAxis = new DetailAxis(tCtx, this.width, TraceUi.AXIS_HEIGHT, this.scale);
    this.detailPanel = new SideDetailPanel(this.state, contentWidth);

    this.listenResize();
  }

  private createRootTree(rootTrackTreeID: string) {
    const tCtx = this.cc.getTrackCanvasContext();
    const tracksCtx = new TrackCanvasContext(tCtx, 0, TraceUi.AXIS_HEIGHT);
    // TODO: Maybe pass this in from the caller since it's already calculated once.
    const contentWidth = this.width - TraceUi.SCROLLBAR_WIDTH;
    // TODO: This constructor has too many arguments. Need better state propagation.
    const rootTrackTreeState = this.state.trackTrees[rootTrackTreeID];
    if (rootTrackTreeState == null) return null;
    return new TrackTree(rootTrackTreeState, this.state.tracks, this.state.trackTrees,
      tracksCtx, contentWidth, new OffsetTimeScale(this.scale,0, this.width),
      this.state.gps, this.state.tracksData);
  }

  public setState(state: State) {
    this.state = state;

    this.overview.setState(this.state);
    this.pc.setState(this.state);
    this.detailPanel.setState(this.state);

    if (this.state.rootTrackTree != null) {
      const rootTrackTreeState = this.state.trackTrees[this.state.rootTrackTree];
      if (rootTrackTreeState == null) return;
      if (this.root == null) {
        this.root = this.createRootTree(this.state.rootTrackTree);
      } else {
        this.root.setState(rootTrackTreeState, this.state.tracks,
          this.state.trackTrees, this.state.gps, this.state.tracksData);
      }
    }

    const canvasHeight = 2 * this.height;
    this.cc.setHeight(canvasHeight);
    const canvasMaxHeight = !this.root ? 0 :
        this.root.height + TraceUi.AXIS_HEIGHT;
    this.cc.setMaxHeight(canvasMaxHeight);

    this._invalidateProperties();
  }

  listenResize() {
    //TODO: Better resize detection needed. Didn't get it to work with event
    // listeners.
    let w: number = 0, h: number = 0;
    let raf = () => {
      if(this.offsetWidth && this.offsetHeight) {
        const newH = this.offsetHeight - this.offsetTop;
        if(w !== this.offsetWidth || h !== newH) {
          w = this.offsetWidth;
          h = newH;
          this.resize(w, h);
        }
      }
      requestAnimationFrame(raf);
    };
    raf();
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.cc.setWinHeight(this.height);
    this.pc.setWinHeight(this.height);
    this._invalidateProperties();
  }

  _render() {
    this.scale.setTimeLimits(this.state.gps.startVisibleWindow,
        this.state.gps.endVisibleWindow);

    this.overview._invalidateProperties();
    if (this.root) this.root._invalidateProperties();
    this.pc._invalidateProperties();
    this.detailAxis.render();
    this.detailPanel._invalidateProperties();

    const panContentContent = html`
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
    <style>
      :host {
        display: block;
        width: 100%;
        height: 100%;
        position: fixed;
      }
      .ui , .content {
        position: relative;
        /*height: 100%;
        overflow: hidden;*/
      }
      .tracks-list {
        position: relative;
        top: ${TraceUi.AXIS_HEIGHT}px
      }
    </style>
    <div id='ui' class="ui">
      ${this.pc}
      ${this.detailPanel}
    </div>
    `;
  }

}

customElements.define('trace-ui', TraceUi);

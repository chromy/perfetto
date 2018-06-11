import {LitElement, html} from '@polymer/lit-element';
import { CanvasController } from './track-canvas-controller';
import {State} from './state';
import {GlobalBrushTimeline} from './overview-timeline/global-brush-timeline';
import {TrackTree} from './track-tree';
import {PanContent} from './pan-content';
import {render} from 'lit-html';
import {OffsetTimeScale, TimeScale} from './time-scale';

export class TraceUi extends LitElement {

  static SCROLLBAR_WIDTH = 16;
  static CONTENT_MARGIN_LEFT = 200;
  static get properties() { return { s: String }}

  private cc: CanvasController;
  private overview: GlobalBrushTimeline;
  private root: TrackTree;
  private pc: PanContent;
  //private overviewScale: TimeScale;
  private scale: TimeScale;

  constructor(private state: State, private width: number,
              private height: number)
  {
    super();
    console.log('Trace UI initialized.', this.width);

    const reRender = () => this._invalidateProperties();

    const canvasHeight = 2 * this.height;

    this.scale = new TimeScale(0, 1000, TraceUi.CONTENT_MARGIN_LEFT,
        this.width - TraceUi.CONTENT_MARGIN_LEFT);

    this.cc = new CanvasController(this.width, canvasHeight, this.height, reRender);
    const tCtx = this.cc.getTrackCanvasContext();
    const contentWidth = this.width - TraceUi.SCROLLBAR_WIDTH;
    this.root = new TrackTree(this.state.trackTree, tCtx,
        contentWidth, new OffsetTimeScale(this.scale,
            TraceUi.CONTENT_MARGIN_LEFT, this.width));
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
  }

  _render() {

    this.scale.setTimeLimits(this.state.gps.startVisibleWindow,
        this.state.gps.endVisibleWindow);

    this.overview._invalidateProperties();
    this.root._invalidateProperties();
    this.pc._invalidateProperties();

    const panContentContent = html`
        
      <style>
      :host {
        display: block;
      }
      .ui {
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
        ${this.root}
        ${this.cc}
      </div>
    </div>
    `;

    render(panContentContent, this.pc);

    return html`
    ${this.pc}
    `;
    //<track-tree tree=rootTree modifiedCtx=cc.getCanvasContext('2D')/>
  }

}

customElements.define('trace-ui', TraceUi);

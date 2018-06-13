import {LitElement, html} from '@polymer/lit-element';
import {State} from '../backend/state';
import * as d3 from 'd3';
import {svg} from 'lit-html';
import {ScaleTime} from 'd3-scale';
import {CpuTimeline} from './cpu-timeline';
import {TimeScale} from '../time-scale';

export class GlobalBrushTimeline extends LitElement {

  private x: ScaleTime<number, number>;
  private xAxis: any;
  private axisEl: any;
  private g: SVGGElement;

  private scale: TimeScale;
  private start: number;
  private end: number;
  public height = 150;
  private margin: {top: number, right: number, bottom: number, left: number};

  private cpuTimeline: CpuTimeline;

  private brushHandleDragState: {
    isLeft: boolean,
    lastXPos: number,
  }|null = null;
  private brushingStartX: number|undefined;

  static get properties() { return { width: Number, brushingStartX: Number }}

  constructor(private state: State,
              private width: number,
              private onBrushed: () => void)
  {
    super();

    this.margin = {
      top: 10,
      right: 20,
      bottom: 20,
      left: 20
    };

    this.start = this.state.maxVisibleWindow.start;
    this.end = this.state.maxVisibleWindow.end;

    this.scale = new TimeScale(this.start, this.end, this.margin.left,
        this.width - this.margin.right);
    this.x = d3.scaleTime().range([this.margin.left, this.width - this.margin.right]);
    this.x.domain([this.start, this.end]);

    this.xAxis = d3.axisBottom(this.x);

    this.g = document.createElementNS('http://www.w3.org/2000/svg', "g");

    this.axisEl = d3.select(this.g).append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + (this.height - this.margin.bottom) + ")");

    this.axisEl
        .call(this.xAxis);

    this.cpuTimeline = new CpuTimeline(this.state, this.x);
  }

  private brushHandleMouseDown(e: MouseEvent, isLeft: boolean) {
    this.brushHandleDragState = {
      isLeft: isLeft,
      lastXPos: e.clientX
    };
    e.stopPropagation();
  }

  private onMouseDown(e: MouseEvent) {
    this.brushingStartX = e.offsetX;
    e.stopPropagation();
  }

  private onMouseMove(e: MouseEvent) {
    if(this.brushHandleDragState) {
      const movedPx = e.clientX - this.brushHandleDragState.lastXPos;
      const movedTs = this.scale.pxToTs(movedPx) - this.scale.pxToTs(0);

      if(this.brushHandleDragState.isLeft) {
        this.state.gps.startVisibleWindow += movedTs;
      }
      else {
        this.state.gps.endVisibleWindow += movedTs;
      }

      this.onBrushed();
      this.brushHandleDragState.lastXPos = e.clientX;
      e.preventDefault();
    }
    else if(this.brushingStartX) {
      const xPositions = [this.brushingStartX, e.offsetX];
      const xLeft = Math.min(...xPositions);
      const xRight = Math.max(...xPositions);
      const tLeft = this.scale.pxToTs(xLeft);
      const tRight = this.scale.pxToTs(xRight);

      this.state.gps.startVisibleWindow = tLeft;
      this.state.gps.endVisibleWindow = tRight;
      this.onBrushed();
      e.preventDefault();
    }
  }

  private onMouseUp() {
    this.brushHandleDragState = null;
    this.brushingStartX = undefined;
  }

  private getChildContent() {
    return html`${this.cpuTimeline}`;
  }

  _render() {

    const svgContent = svg`
        ${this.g}
        `;

    return html`
    <style>
      .wrap {
        position: sticky;
        top: -1px;
        height: 150px;
        width: ${this.width}px;
        background:#eee;
        box-sizing: border-box;
        z-index: 500;
        will-change: transform;
      }
      svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
      .brush .selection { stroke: none; }
      .brush-left, .brush-right {
        position: absolute;
        background: rgba(210,210,210,0.7);
        top: ${this.margin.top}px;
        height: ${this.height-this.margin.bottom-this.margin.top}px;
        z-index: 100;
        pointer-events: none;
      }
      .brush-left {
        left: ${this.margin.left}px;
        width: ${this.scale.tsToPx(this.state.gps.startVisibleWindow) - this.margin.left}px;
      }
      .brush-right {
        left: ${this.scale.tsToPx(this.state.gps.endVisibleWindow)}px;
        width: ${this.width - this.margin.right - this.scale.tsToPx(this.state.gps.endVisibleWindow)}px;
      }
      .brush .handle {
        position: absolute;
        top: ${(this.height-this.margin.top-this.margin.bottom)/2-15}px;
        height: 30px;
        width: 12px;
        background: #fff;
        border-radius: 3px;
        border: 1px solid #999;
        cursor: pointer;
        z-index: 100;
        pointer-events: ${this.brushingStartX ? 'none' : 'auto'};
      }
      .brush-left .handle {
        left: ${this.scale.tsToPx(this.state.gps.startVisibleWindow)-this.margin.left-6}px;
      }
      .brush-right .handle {
        left: -6px;
      }
    </style>
    <div class="wrap"
      style="padding: ${this.margin.top}px 0px ${this.margin.bottom}px 0px"
      on-mousedown=${(e: MouseEvent) => { this.onMouseDown(e); }}
      on-mousemove=${(e: MouseEvent) => { this.onMouseMove(e); }}
      on-mouseup="${() => { this.onMouseUp(); }}">
      <div class="brush">
        <div class="brush-left">
          <div class="handle" 
            on-mousedown=${(e: MouseEvent) => { this.brushHandleMouseDown(e, true); }}></div>
        </div>
        <div class="brush-right">
          <div class="handle"
             on-mousedown=${(e: MouseEvent) => { this.brushHandleMouseDown(e, false); }}></div>
          </div>
      </div>
      ${this.getChildContent()}
      <svg>
        ${svgContent}
      </svg>
    </div>`;
  }
}

customElements.define('global-brush-timeline', GlobalBrushTimeline);

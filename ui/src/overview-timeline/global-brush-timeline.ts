import {LitElement, html} from '@polymer/lit-element';
import {State} from '../state';
import * as d3 from 'd3';
import {svg} from 'lit-html';
import {ScaleTime} from 'd3-scale';
import {CpuTimeline} from './cpu-timeline';

export class GlobalBrushTimeline extends LitElement {

  private x: ScaleTime<number, number>;
  private xAxis: any;
  private axisEl: any;
  private brush: any;
  private brushEl: any;
  private g: SVGGElement;

  private start = 0;
  private end = 10000;
  public height = 150;
  private margin: {top: number, right: number, bottom: number, left: number};

  private cpuTimeline: CpuTimeline;
  private manualBrushSet = 0;

  static get properties() { return { width: Number }}

  constructor(private state: State, private width: number, onBrushed: () => void)
  {
    super();
    console.log(this.state);

    this.margin = {
      top: 10,
      right: 20,
      bottom: 20,
      left: 20
    };

    this.x = d3.scaleTime().range([this.margin.left, this.width - this.margin.right]);
    this.x.domain([this.start, this.end]);

    this.xAxis = d3.axisBottom(this.x);

    this.g = document.createElementNS('http://www.w3.org/2000/svg', "g");

    this.axisEl = d3.select(this.g).append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + (this.height - this.margin.bottom) + ")");

    this.axisEl
        .call(this.xAxis);

    this.brush = d3.brushX()
        .extent([[0,0], [this.width , this.height - this.margin.bottom ]])
        .on("brush end", () =>
        {
          if(this.manualBrushSet === 0)
          {
            //TODO: This should be communicated to some central place and then to the worker.
            this.state.gps.startVisibleWindow = this.x.invert(+d3.event.selection[0]).getTime();
            this.state.gps.endVisibleWindow = this.x.invert(+d3.event.selection[1]).getTime();

            onBrushed();
            //this.dispatchEvent(new CustomEvent(brushEventName, { detail: [start, end]}));
          }
          else
          {
            this.manualBrushSet--;
          }
        });

    this.brushEl = d3.select(this.g).append("g")
        .attr("class", "brush");

    this.brushEl
        .call(this.brush);

    this.setBrush();

    this.cpuTimeline = new CpuTimeline(this.state, this.x);

    /*setTimeout(() => setInterval(() => {
      this.width = 500 + Math.round(Math.random() * 1000);
      this.x.range([this.margin.left, this.width - this.margin.right]);
      this.axisEl
          .transition()
          .call(this.xAxis);
      this.brushEl
          .transition()
          .call(this.brush.move, [
          this.x(this.state.gps.startVisibleWindow),
          this.x(this.state.gps.endVisibleWindow)]);

      this.cpuTimeline._invalidateProperties();
    }, 2000), 1000);*/
  }

  private setBrush()
  {
    // onBrushEnd is called twice after this.
    this.manualBrushSet += 2;

    this.brushEl
        .call(this.brush.move, [
          this.x(this.state.gps.startVisibleWindow),
          this.x(this.state.gps.endVisibleWindow)]);
  }

  private getChildContent()
  {
    return html`${this.cpuTimeline}`;
  }

  _render() {

    const svgContent = svg`
        ${this.g}
        `;

    this.setBrush();

    return html`
    <style>
      .wrap {
        position: sticky;
        top: -1px;
        height: 150px;
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
    </style>
    <div class="wrap" style="padding: ${this.margin.top}px 0px ${this.margin.bottom}px 0px">
      ${this.getChildContent()}
      <svg>
        ${svgContent}
      </svg>
    </div>`;
  }
}

customElements.define('global-brush-timeline', GlobalBrushTimeline);

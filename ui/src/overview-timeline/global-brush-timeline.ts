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

  private start = 0;
  private end = 10000;
  private width = 1000;
  private height = 150;

  constructor(private state: State)
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
          // const start = this.x.invert(+d3.event.selection[0]).getTime();
          // const end = this.x.invert(+d3.event.selection[1]).getTime();
          //
          // console.log(start, end);
          //this.dispatchEvent(new CustomEvent(brushEventName, { detail: [start, end]}));
        });

    this.brushEl = d3.select(this.g).append("g")
        .attr("class", "brush");

    let brushStart = 500;
    let brushEnd = 3000;

    this.brushEl
        .call(this.brush)
        .call(this.brush.move, [this.x(brushStart), this.x(brushEnd)]);
  }

  private getChildContent()
  {
    this.cpuTimeline = new CpuTimeline(this.state, this.x);

    return html`${this.cpuTimeline}`;
  }

  _render() {

    const svgContent = svg`
        ${this.g}
        `;

    return html`
    <style>
      .wrap {
        position: relative;
        height: 150px;
        background:#eee;
        box-sizing: border-box;
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

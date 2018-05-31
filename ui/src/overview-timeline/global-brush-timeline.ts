import {LitElement, html} from '@polymer/lit-element';
import {State} from '../state';
import * as d3 from 'd3';
import {svg} from 'lit-html';

export class GlobalBrushTimeline extends LitElement {

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

    this.start = 0;
    this.end = 10000;

    this.x = d3.scaleTime().range([this.margin.left, 1000 - this.margin.right]);
    this.x.domain([this.start, this.end]);

    this.xAxis = d3.axisBottom(this.x);

    this.g = document.createElementNS('http://www.w3.org/2000/svg', "g");

    this.axisEl = d3.select(this.g).append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + (150 - this.margin.bottom) + ")");

    this.axisEl
        .call(this.xAxis);

  }

  _render() {

    // I'd like to do this, but I get 'TypeError: Cannot assign to read only property 'transform'".
    // <g class="axis axis--g" transform="translate(0, ${150-this.margin.bottom})"></g>

    const svgContent = svg`
        ${this.g}
        `;

    return html`
    <style>
      .wrap {
        position: relative;
        height: 150px;
      }
      svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background:#ccc;
      }
    </style>
    <div class="wrap">
      <svg>
        ${svgContent}
      </svg>
      <slot></slot>
    </div>`;
  }

}

customElements.define('global-brush-timeline', GlobalBrushTimeline);
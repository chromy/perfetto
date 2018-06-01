import {LitElement, html} from '@polymer/lit-element';
import {State} from '../state';
import {render, svg} from 'lit-html';
import * as d3 from 'd3';

export class CpuTimeline extends LitElement {

  private height = 100;
  private cpuData: { time: number, cpu: number}[] = [];
  private path: SVGPathElement;

  static get properties() { return { height: Number, cpuData: [String] }}

  constructor(private state: State, private x)
  {
    super();

    console.log(this.state);

    this.y = (cpu) => { return this.height - cpu * this.height };

    this.setRandomCpuData();

    setInterval(() => this.setRandomCpuData(), 800);

    this.path = document.createElementNS('http://www.w3.org/2000/svg', "path");
    this.path.setAttribute('stroke', '#d70');
    this.path.setAttribute('fill', 'none');
  }

  private setRandomCpuData()
  {
    const start = 0;
    const end = 10000;
    this.cpuData = [];

    for(let time = start; time <= end; time += (end - start) / 100)
    {
      this.cpuData.push({time: time, cpu: Math.random()});
    }
  }

  private getPathD()
  {
    let d = 'M';

    for(const dataPoint of this.cpuData)
    {
      d += this.x(dataPoint.time) +  ' ' + this.y(dataPoint.cpu) + ' L';
    }
    d = d.substr(0, d.length - 1);

    return d;
  }

  _render() {

    const d = this.getPathD();

    d3.select(this.path).transition().attr('d', d);

    const svgContent = svg`${this.path}`;

    const g = document.createElementNS('http://www.w3.org/2000/svg', "g");
    render(svgContent, g);
    // I dont know why I need to render it first, but I do.

    return html`
    <style>
      .wrap {
        position: relative;
        height: 100px;
      }
      svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
    </style>
    <div class="wrap">
      <svg>
        ${g}
        <text y="20" x="20">Cpu Timeline</text>
      </svg>
    </div>`;
  }

}

customElements.define('cpu-timeline', CpuTimeline);
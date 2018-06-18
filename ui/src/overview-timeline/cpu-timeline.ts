import { LitElement, html } from '@polymer/lit-element';
import * as d3 from 'd3';
import { render, svg } from 'lit-html';
import { CpuDataPoint, State } from '../backend/state';
import { TimeScale } from '../time-scale';

export class CpuTimeline extends LitElement {

  private height = 100;
  private cpuData: CpuDataPoint[] = [];
  private path: SVGPathElement;
  private y: ((v: number) => number);

  static get properties() { return { height: Number, cpuData: [String] }}

  constructor(private state: State, private scale: TimeScale)
  {
    super();

    this.y = (cpu) => { return this.height - cpu * this.height };

    this.setRandomCpuData();

    //setInterval(() => this.setRandomCpuData(), 2000);

    this.path = document.createElementNS('http://www.w3.org/2000/svg', "path");
    this.path.setAttribute('stroke', '#d70');
    this.path.setAttribute('fill', 'none');
  }

  public setState(state: State) {
    this.state = state;
    if (this.state.traceCpuData.length > 0) {
      this.cpuData = this.state.traceCpuData;
      const maxCpu = Math.max(...this.cpuData.map(d => d.cpu));
      this.y = (cpu) => (this.height - (cpu/ maxCpu) * this.height);
    }
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
      d += this.scale.tsToPx(dataPoint.time) +  ' ' + this.y(dataPoint.cpu) + ' L';
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

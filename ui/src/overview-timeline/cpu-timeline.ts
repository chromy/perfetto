import {LitElement, html} from '@polymer/lit-element';
import {State} from '../state';
import {render, svg} from 'lit-html';

export class CpuTimeline extends LitElement {

  private height = 100;
  private width = 1000 - 40;
  private cpuData: { time: number, cpu: number}[];

  constructor(private state: State)
  {
    super();

    console.log(this.state);

    const start = 0;
    const end = 10000;
    this.x = (time) => { return (time - start) / (end - start)* this.width };
    this.y = (cpu) => { return this.height - cpu * this.height };

    this.cpuData = [];

    for(let time = start; time <= end; time += (end - start) / 100)
    {
      this.cpuData.push({time: time, cpu: Math.random()});
    }
  }

  private getPathD()
  {
    // Adding new data
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

    const svgContent = svg`
      <path stroke="#d70" fill="none" d='${d}' />
    `;

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
        <text y="20" x="10">Cpu Timeline</text>
        ${g}
      </svg>
    </div>`;
  }

}

customElements.define('cpu-timeline', CpuTimeline);
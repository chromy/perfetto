import {LitElement} from '@polymer/lit-element';
import {html} from 'lit-html/lib/lit-extended';
import {TemplateResult} from 'lit-html';

export abstract class TrackContent extends LitElement {

  /*protected width: number;*/

  protected start = 0;
  protected end = 1000;

  protected eventTemplate: TemplateResult;
  private mouseDownX = -1;

  public height: number;
  protected x: (number) => number = () => 0;

  constructor(protected width: number) {
    super();

    this.height = this.getHeight();

    this.eventTemplate = html`<style>
      :host {
        position: absolute;
        top: 0;
        left: 0;
      }
      .event-capture {
        width: ${this.width}px;
        height: ${this.height}px;
        z-index: 100;
        position: relative;
      }
    </style>
    
    <div class="event-capture"
       on-click=${(e) => { console.log(e); } }
         on-mousedown=${(e) => { this.onMouseDown(e); } }
         on-mousemove=${(e) => { this.onMouseMove(e); } }
         on-mouseup=${() => { this.onMouseUp(); } }
        >
    </div>`;
  }

  protected getHeight(): number {
    return 100;
  }

  protected onMouseDown(e: MouseEvent) {
    this.mouseDownX = e.clientX;
  }

  protected onMouseMove(e: MouseEvent)
  {
    if(this.mouseDownX !== -1) {
      const moved = e.clientX - this.mouseDownX;
      console.log('move', moved);
    }
  }

  protected onMouseUp() {
    this.mouseDownX = -1;
  }

  public setLimits(start: number, end: number)
  {
    this.start = start;
    this.end = end;

    this.x = (t: number) => {
      if(t < this.start) return 0;
      if(t > this.end) return this.width;
      return (t - this.start) / (this.end - this.start) * this.width;
    }
  }


  render? (ctx: CanvasRenderingContext2D): void;
}

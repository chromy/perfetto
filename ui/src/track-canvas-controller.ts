import {LitElement} from '@polymer/lit-element';
import {html} from 'lit-html';

export class CanvasController  extends LitElement {
  // Owns the canvas.

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(private width: number, private height: number = 1000)
  {
    super();

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('height', this.height.toString());
    this.canvas.setAttribute('width', this.width.toString());
    console.log('Canvas created.');

    //TODO: getContext can return null. Need better solution.
    this.ctx = <CanvasRenderingContext2D> this.canvas.getContext('2d');
  }

  setHeight(height: number) {
    this.height = height;
    this.canvas.setAttribute('height', this.height.toString());
  }

  getContext2D() {
    return this.ctx;
  }

  render() {
    //TODO: Defines height/width etc.
  }

  onResize()
  {
    //TODO
  }

  _render()
  {
    return html`
      <style>
        :host {
          position: absolute;
          top: 0;
          pointer-events: none;
        }
      </style>
      ${this.canvas}`;
  }
}

customElements.define('canvas-controller', CanvasController);

export class TrackCanvasContext {
  //TODO: Implement.
  constructor(private ctx: CanvasRenderingContext2D | TrackCanvasContext,
              private xOffset: number,
              private yOffset: number) {}

  fillRect(x: number, y: number, width: number, height: number) {
    this.ctx.fillRect(x + this.xOffset, y + this.yOffset, width, height);
  }

  set strokeStyle(v: string) {
    this.ctx.strokeStyle = v;
  }

  set fillStyle(v: string) {
    this.ctx.fillStyle = v;
  }
}

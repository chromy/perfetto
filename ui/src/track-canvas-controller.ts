import {LitElement} from '@polymer/lit-element';
import {html} from 'lit-html';

export class CanvasController  extends LitElement {
  // Owns the canvas.

  static get properties() { return { top: Number }}

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tCtx : TrackCanvasContext;
  private top = 0;

  constructor(private width: number,
              private height: number,
              private winHeight: number,
              reRender: () => void)
  {
    super();

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('height', this.height.toString());
    this.canvas.setAttribute('width', this.width.toString());
    console.log('Canvas created.');

    //TODO: getContext can return null. Need better solution.
    this.ctx = <CanvasRenderingContext2D> this.canvas.getContext('2d');

    this.tCtx = new TrackCanvasContext(this.getContext2D(), 0, 0);

    //TODO: This interval should probably not be here.
    // Might need an event listener higher up.
    setInterval(() => {

      const scrollTop = document.documentElement.scrollTop;
      const extraHeight = this.height - this.winHeight;
      this.top = scrollTop - Math.round(extraHeight / 2);
      this.tCtx.setYOffset(this.top * -1);

      this.ctx.clearRect(0,0,this.width, this.height);
      reRender(); //TODO the update should be handled differently.

    }, 100);
  }

  getContext2D() {
    return this.ctx;
  }

  getTrackCanvasContext() {
    return this.tCtx;
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
          top: ${this.top}px;
          pointer-events: none;
        }
      </style>
      ${this.canvas}`;
  }
}

customElements.define('canvas-controller', CanvasController);

export class TrackCanvasContext {

  private width = 0;
  private height = 0;

  constructor(private ctx: CanvasRenderingContext2D | TrackCanvasContext,
              private xOffset: number,
              private yOffset: number) {}

  fillRect(x: number, y: number, width: number, height: number) {

    if(x < 0 || x + width > this.width ||
       y < 0 || y + height > this.height) {
      throw new OutOfBoundsDrawingError('Rect out of bounds ' +
          this.width + ', ' + this.height);
    }

    this.ctx.fillRect(x + this.xOffset, y + this.yOffset, width, height);
  }

  public setDimensions(width: number, height: number)
  {
    this.width = width;
    this.height = height;
  }

  public setYOffset(offset: number) {
    this.yOffset = offset;
  }

  set strokeStyle(v: string) {
    this.ctx.strokeStyle = v;
  }

  set fillStyle(v: string) {
    this.ctx.fillStyle = v;
  }
}

export class OutOfBoundsDrawingError extends Error {

}
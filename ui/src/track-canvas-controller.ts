import {LitElement} from '@polymer/lit-element';
import {html} from 'lit-html';

export class CanvasController  extends LitElement {
  // Owns the canvas.

  static get properties() { return { top: Number }}

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tCtx : TrackCanvasContext;
  private top = 0;
  private maxHeight = 100000;

  constructor(private width: number,
              private height: number,
              private winHeight: number,
              private reRender: () => void)
  {
    super();

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('height', this.height.toString());
    this.canvas.setAttribute('width', this.width.toString());
    console.log('Canvas created.');

    //TODO: getContext can return null. Need better solution.
    this.ctx = <CanvasRenderingContext2D> this.canvas.getContext('2d');

    this.tCtx = new TrackCanvasContext(this.getContext2D(), 0, 0);
    this.tCtx.setDimensions(this.width, this.height);
  }

  setScrollTop(scrollTop: number)
  {
    const extraHeight = this.height - this.winHeight;
    this.top = scrollTop - Math.round(extraHeight / 2);
    this.tCtx.setYOffset(this.top * -1);

    this.ctx.clearRect(0,0,this.width, this.height);
    this.reRender(); //TODO the update should be handled differently.
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

  onResize() {
    //TODO
  }

  setHeight(height: number) {
    this.height = height;
    this.canvas.setAttribute('height', this.height.toString());
    this.tCtx.setDimensions(this.width, this.height);
  }

  setMaxHeight(maxHeight: number) {
    this.maxHeight = maxHeight;
    this._invalidateProperties();
  }

  _render()
  {
    return html`
      <style>
        :host {
          width: ${this.width}px;
          height: ${this.maxHeight}px;
          pointer-events: none;
          overflow: hidden;
          display: block;
          position: absolute;
          top: 0;
        }
        .wrap {
          position: absolute;
          top: ${this.top}px;
        }
      </style>
      <div class="wrap">
        ${this.canvas}
      </div>`;
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
      /*throw new OutOfBoundsDrawingError('Rect out of bounds ' +
          this.width + ', ' + this.height + ': topleft ' + x + ', ' + y +
          ', bottom right: ' + (x + width) + ', ' + (y + height));*/
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

  public moveTo(x: number, y: number) {
    this.ctx.moveTo(x + this.xOffset, y + this.yOffset);
  }

  public lineTo(x: number, y: number) {
    this.ctx.lineTo(x + this.xOffset, y + this.yOffset);
  }

  public stroke() {
    this.ctx.stroke();
  }

  public beginPath() {
    this.ctx.beginPath();
  }

  public closePath() {
    this.ctx.closePath();
  }

  public measureText(text: string): TextMetrics {
    return this.ctx.measureText(text);
  }

  public fillText(text: string, x: number, y: number) {
    this.ctx.fillText(text, x + this.xOffset, y + this.yOffset);
  }

  set strokeStyle(v: string) {
    this.ctx.strokeStyle = v;
  }

  set fillStyle(v: string) {
    this.ctx.fillStyle = v;
  }

  set lineWidth(width: number) {
    this.ctx.lineWidth = width;
  }

  set font(fontString: string) {
    this.ctx.font = fontString;
  }
}

export class OutOfBoundsDrawingError extends Error {

}

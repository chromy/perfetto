import {LitElement} from '@polymer/lit-element';
import {TrackCanvasContext} from './track-canvas-controller';
import {OffsetTimeScale} from './time-scale';

export abstract class TrackContent extends LitElement {

  /*protected width: number;*/

  protected start = 0;
  protected end = 1000;

  public height: number;

  constructor(protected tCtx: TrackCanvasContext,
              protected x: OffsetTimeScale) {
    super();

    this.height = this.getHeight();
  }

  protected getHeight(): number {
    return 100;
  }

  protected drawGridLines(): void {
    this.tCtx.strokeStyle = '#aa0000';
    this.tCtx.lineWidth = 1;

    const limits = this.x.getTimeLimits();
    const range = limits.end - limits.start;
    let step = 1;
    while(range / step > 20) {
      step *= 10;
    }
    if(range / step < 5) {
      step /= 5;
    }
    if(range / step < 10) {
      step /= 2;
    }

    for(let t = 0; t < 10000; t += step) {
      const xPos = this.x.tsToPx(t);

      this.tCtx.beginPath();
      this.tCtx.moveTo(xPos, 0);
      this.tCtx.lineTo(xPos, this.height);
      this.tCtx.stroke();
    }
  }

  render? (ctx: CanvasRenderingContext2D): void;
}

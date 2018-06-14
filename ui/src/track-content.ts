import {LitElement} from '@polymer/lit-element';
import {TrackCanvasContext} from './track-canvas-controller';
import {OffsetTimeScale} from './time-scale';
import {GlobalPositioningState} from './backend/state';

export abstract class TrackContent extends LitElement {

  /*protected width: number;*/

  protected start = 0;
  protected end = 1000;

  public height: number;

  constructor(protected tCtx: TrackCanvasContext,
              protected x: OffsetTimeScale,
              protected gps: GlobalPositioningState) {
    super();

    this.height = this.getHeight();
  }

  public setGps(gps: GlobalPositioningState) {
    this.gps = gps;
  }

  protected getHeight(): number {
    return 100;
  }

  protected drawGridLines(): void {
    this.tCtx.strokeStyle = 'black';
    this.tCtx.lineWidth = 1;

    const limits = this.x.getTimeLimits();
    const range = limits.end - limits.start;
    let step = 0.001;
    while(range / step > 20) {
      step *= 10;
    }
    if(range / step < 5) {
      step /= 5;
    }
    if(range / step < 10) {
      step /= 2;
    }

    const start = Math.round(limits.start / step) * step;

    for(let t = start; t <= limits.end; t += step) {
      const xPos = Math.floor(this.x.tsToPx(t))+0.5;

      this.tCtx.beginPath();
      this.tCtx.moveTo(xPos, 0);
      this.tCtx.lineTo(xPos, this.height);
      this.tCtx.stroke();
    }
  }

  render? (ctx: CanvasRenderingContext2D): void;
}

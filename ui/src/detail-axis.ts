import {TrackCanvasContext} from './track-canvas-controller';
import {TimeScale} from './time-scale';

export class DetailAxis {

  constructor(private tCtx: TrackCanvasContext, private width: number,
              private height: number, private x: TimeScale) {

  }

  render() {

    this.tCtx.fillStyle = 'black';
    this.tCtx.fillRect(0, 0, this.width, this.height);

    this.tCtx.font = '18px Arial';
    this.tCtx.strokeStyle = 'red';
    this.tCtx.lineWidth = 2;
    const widthPerLetter = 8;

    const limits = this.x.getTimeLimits();
    const range = limits.end - limits.start;
    let step = 1;
    while(range / step > 20) {
      step *= 10;
    }
    if(step > 1) {
      if(range / step < 5) {
        step /= 5;
      }
      if(range / step < 10) {
        step /= 2;
      }
    }
    // TODO: Figure out sub 1 labels.

    const start = Math.round(limits.start / step) * step;

    for(let t = start; t <= limits.end; t += step) {
      const tRounded = Math.round(Math.round(t / step) * step);
      const xPos = this.x.tsToPx(t);

      this.tCtx.beginPath();
      this.tCtx.moveTo(xPos, 30);
      this.tCtx.lineTo(xPos, this.height);
      this.tCtx.stroke();

      this.tCtx.fillStyle = 'red';
      const text = tRounded.toString();
      const offset = Math.floor(text.length / 2) * widthPerLetter + widthPerLetter / 2;
      this.tCtx.fillText(text, xPos - offset, 22);
    }
  }
}

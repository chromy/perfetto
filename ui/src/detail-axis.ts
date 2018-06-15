import {TrackCanvasContext} from './track-canvas-controller';
import {TimeScale} from './time-scale';

export class DetailAxis {
  zeroWidth?: number;

  constructor(private tCtx: TrackCanvasContext, private width: number,
              private height: number, private x: TimeScale) {
  }

  render() {
    this.tCtx.fillStyle = '#f3f8fe';
    this.tCtx.fillRect(0, 0, this.width, this.height);

    this.tCtx.font = '300 18px Roboto Mono';
    this.tCtx.strokeStyle = 'black';
    this.tCtx.lineWidth = 1;

    if (!this.zeroWidth)
      this.zeroWidth = this.tCtx.measureText('0').width;
    const widthPerLetter = this.zeroWidth;

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

    let unit = 'ns';
    let representationFactor = 1;

    if(step >= 1000000) {
      unit = 's';
      representationFactor = 1 / 1000000;
    } else if(step >= 1000) {
      unit = 'ms';
      representationFactor = 1 / 1000;
    }

    this.tCtx.fillStyle = 'black';
    this.tCtx.fillText('Time in ' + unit, 10, 22);

    const start = Math.round(limits.start / step) * step;

    for(let t = start; t <= limits.end; t += step) {
      const tRounded = Math.round(Math.round(t / step) * step);
      // To get a sharp line you have to draw at X.5.
      const xPos = Math.floor(this.x.tsToPx(t))+0.5;

      this.tCtx.beginPath();
      this.tCtx.moveTo(xPos, 30);
      this.tCtx.lineTo(xPos, this.height);
      this.tCtx.stroke();

      this.tCtx.fillStyle = 'black';
      const text = (tRounded * representationFactor).toString();
      const offset = (text.length / 2) * widthPerLetter;
      this.tCtx.fillText(text, xPos - offset, 22);
    }
  }
}

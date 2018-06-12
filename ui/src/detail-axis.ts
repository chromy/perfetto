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
    if(range / step < 5) {
      step /= 5;
    }
    if(range / step < 10) {
      step /= 2;
    }

    for(let t = 0; t < 10000; t += step) {
      const xPos = this.x.tsToPx(t);

      this.tCtx.beginPath();
      this.tCtx.moveTo(xPos, 30);
      this.tCtx.lineTo(xPos, this.height);
      this.tCtx.stroke();

      this.tCtx.fillStyle = 'red';
      const text = t.toString();
      const offset = Math.floor(text.length / 2) * widthPerLetter + widthPerLetter / 2;
      this.tCtx.fillText(text, xPos - offset, 22);
    }
  }
}

export class TimeScale {

  constructor(private tStart: Nanoseconds,
              private tEnd: Nanoseconds,
              private pxStart: Pixels,
              private pxEnd: Pixels,
              private pxOffset: Pixels = 0) {

  }

  public tsToPx(time: Nanoseconds): Pixels {

    /*if(time < this.tStart) return this.pxStart;
    if(time > this.tEnd) return this.pxEnd;*/

    const percentage: number = (time - this.tStart) / (this.tEnd - this.tStart);
    const percentagePx = percentage * (this.pxEnd - this.pxStart);
    return this.pxStart + percentagePx - this.pxOffset;
  }

  public pxToTs(px: Pixels): Nanoseconds {
    const percentage = (px - this.pxStart) / (this.pxEnd - this.pxStart);
    return this.tStart + percentage * (this.tEnd - this.tStart);
  }

  public relativePxToTs(px: Pixels): Nanoseconds {
    return this.pxToTs(px) - this.pxToTs(0);
  }

  public setTimeLimits(tStart: Nanoseconds, tEnd: Nanoseconds) {
    this.tStart = tStart;
    this.tEnd = tEnd;
  }

  public getTimeLimits() {
    return {
      start: this.tStart,
      end: this.tEnd
    };
  }
}

export class OffsetTimeScale {

  constructor(private scale: (TimeScale|OffsetTimeScale),
              private pxOffset: Pixels,
              private width: Pixels) {
  }

  public tsToPx(time: Nanoseconds): Pixels {
    const result = this.scale.tsToPx(time) - this.pxOffset;
    if(result < 0) return 0;
    if(result > this.width)
      return this.width;

    return result;
  }

  public pxToTs(px: Pixels): Nanoseconds {
    return this.scale.pxToTs(px + this.pxOffset);
  }

  public relativePxToTs(px: Pixels): Nanoseconds {
    return this.scale.pxToTs(px + this.pxOffset) - this.scale.pxToTs(0);
  }

  public getTimeLimits(): {start: Nanoseconds, end: Nanoseconds} {
    return this.scale.getTimeLimits();
  }
}

// We are using enums because TypeScript does proper type checking for those,
// and disallows assigning a pixel value to a milliseconds value, even though
// there are numbers. Using types, this safeguard would not be here.
// See: https://stackoverflow.com/a/43832165

export enum Pixels {}
export enum Nanoseconds {}

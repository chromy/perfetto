export class TimeScale {

  constructor(private tStart: number,
              private tEnd: number,
              private pxStart: number,
              private pxEnd: number,
              private pxOffset: number = 0) {

  }

  public tsToPx(time: number): number {

    /*if(time < this.tStart) return this.pxStart;
    if(time > this.tEnd) return this.pxEnd;*/

    const percentage: number = (time - this.tStart) / (this.tEnd - this.tStart);
    const percentagePx = percentage * (this.pxEnd - this.pxStart);
    return this.pxStart + percentagePx - this.pxOffset;
  }

  public pxToTs(px: number): number {
    const percentage = (px - this.pxStart) / (this.pxEnd - this.pxStart);
    return this.tStart + percentage * (this.tEnd - this.tStart);
  }

  public setTimeLimits(tStart: number, tEnd: number) {
    this.tStart = tStart;
    this.tEnd = tEnd;
  }

  public getPxLimits() {
    return { start: this.pxStart, end: this.pxEnd };
  }
}

export class OffsetTimeScale {

  constructor(private scale: (TimeScale|OffsetTimeScale),
              private pxOffset: number) {

  }

  public tsToPx(time: number): number {
    const result = this.scale.tsToPx(time) - this.pxOffset;
    if(result < 0) return 0;
    if(result > this.scale.getPxLimits().end)
      return this.scale.getPxLimits().end;

    return result;
  }

  public getPxLimits(): {start: number, end: number} {
    const limits = this.scale.getPxLimits();
    return { start: limits.start - this.pxOffset,
      end: limits.end - this.pxOffset};
  }

}
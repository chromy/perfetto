import {LitElement} from '@polymer/lit-element';

export abstract class TrackContent extends LitElement {

  /*protected width: number;*/

  protected start = 0;
  protected end = 1000;

  public height: number;
  protected x: (v: number) => number = () => 0;

  constructor(protected width: number) {
    super();

    this.height = this.getHeight();
  }

  protected getHeight(): number {
    return 100;
  }

  public setLimits(start: number, end: number)
  {
    this.start = start;
    this.end = end;

    this.x = (t: number) => {
      if(t < this.start) return 0;
      if(t > this.end) return this.width;
      return (t - this.start) / (this.end - this.start) * this.width;
    }
  }


  render? (ctx: CanvasRenderingContext2D): void;
}

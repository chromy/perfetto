import {LitElement} from '@polymer/lit-element';

export abstract class TrackContent extends LitElement {

  /*protected width: number;*/

  protected start = 0;
  protected end = 1000;

  public height: number;

  constructor(protected width: number) {
    super();

    this.height = this.getHeight();
  }

  protected getHeight(): number {
    return 100;
  }

  render? (ctx: CanvasRenderingContext2D): void;
}

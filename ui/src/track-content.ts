import {LitElement} from '@polymer/lit-element';

export abstract class TrackContent extends LitElement {
  // draw? (ctx);
  render? (ctx: CanvasRenderingContext2D): void;
}

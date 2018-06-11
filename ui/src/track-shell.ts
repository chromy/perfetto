import {LitElement} from '@polymer/lit-element';
import {html} from 'lit-html';

export class TrackShell extends LitElement {

  private shellWidth = 200;

  constructor(private height: number,
              private width: number,
              private name: string)
  {
    super();
  }

  get contentPosition() : { top: number, right: number, bottom: number, left: number } {
    return { top: 0, right: 0, bottom: 0, left: 200 };
  }

  public getContentWidth() {
    return this.width - this.contentPosition.left - this.contentPosition.right;
  }

  public _render() {
    return html`
    <style>
    :host {
      height: ${this.height}px;
      width: ${this.width}px;
      display: block;
      box-sizing: border-box;
    }
    .wrap {
      background: #eee;
      width: ${this.width}px;
      height: ${this.height}px;
      box-sizing: border-box;
      position: relative;
    }
    .shell-content {
      background:#eee;
      box-sizing: border-box;
      padding: 20px;
      width: ${this.shellWidth}px;
      height: ${this.height}px;
      display: block;
    }
    .track-content {
      position: absolute;
      top: ${this.contentPosition.top}px;
      left: ${this.contentPosition.left}px; 
      width: ${this.width-this.contentPosition.left-this.contentPosition.right}px;
    }
    </style>
    <div class="wrap">
      <div class="shell-content">${this.name}</div>
      <div class="track-content">
        <slot></slot>
      </div>
    </div>`;
  }
}

customElements.define('track-shell', TrackShell);

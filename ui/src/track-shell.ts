import {LitElement} from '@polymer/lit-element';
import {html} from 'lit-html';

export class TrackShell extends LitElement {

  private shellWidth = 200;

  constructor(private height: number,
              private width: number,
              private name: string) {
    super();
  }

  get contentPosition() : { top: number, right: number, bottom: number, left: number } {
    return { top: 0, right: 0, bottom: 1, left: 200 };
  }

  public getContentWidth() {
    return this.width - this.contentPosition.left - this.contentPosition.right;
  }

  public setWidth(width: number) {
    this.width = width;
    this._invalidateProperties();
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
      width: ${this.width}px;
      height: ${this.height}px;
      box-sizing: border-box;
      position: relative;
      border-bottom: 1px solid #999;
    }
    .shell-content {
      background:#eee;
      box-sizing: border-box;
      padding: 10px 20px;
      width: ${this.shellWidth - 1}px;
      height: ${this.height - 1}px;
      display: block;
      border-left: 8px solid #36aa89;
      border-right: 1px solid #999;
    }
    .track-content {
      position: absolute;
      top: ${this.contentPosition.top}px;
      left: ${this.contentPosition.left}px; 
      width: ${this.width - this.contentPosition.left - this.contentPosition.right}px;
      height: ${this.height - this.contentPosition.top - this.contentPosition.bottom}px;
    }
    ul {
      padding-left: 30px;
      
    }
    </style>
    <div class="wrap">
      <div class="shell-content">
        <b>${this.name}</b>
      </div>
      <div class="track-content">
        <slot></slot>
      </div>
    </div>`;
  }
}

customElements.define('track-shell', TrackShell);

import {LitElement} from '@polymer/lit-element';
import {html} from 'lit-html';

export class TrackShell extends LitElement {

  constructor(private height: number,
              private width: number,
              private name: string)
  {
    super();
  }

  public _render() {
    return html`
    <style>
      .wrap {
        background: #eee;
        padding: 20px;
        width: ${this.width}px;
        height: ${this.height}px;
        box-sizing: border-box;
      }
    </style>
    <div class="wrap"> ${this.name}
    </div>`;
  }
}

customElements.define('track-shell', TrackShell);

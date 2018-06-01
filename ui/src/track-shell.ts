import {LitElement} from '@polymer/lit-element';
import {html} from 'lit-html';

export class TrackShell extends LitElement {

  constructor()
  {
    super();
  }

  public _render() {
    return html`
    <style>
      .wrap {
        background: #eee;
        padding: 20px;
      }
    </style>
    <div class="wrap"> Track Shell!
    </div>`;
  }
}

customElements.define('track-shell', TrackShell);

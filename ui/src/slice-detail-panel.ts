import {LitElement, html} from '@polymer/lit-element';
import {State, TrackSlice} from './backend/state';
import {TemplateResult} from 'lit-html';

export class SideDetailPanel extends LitElement {
  public height: number = 100;
  private slice: TrackSlice|null = null;

  constructor(private state: State, private width: number)
  {
    super();

    this.setState(this.state);
  }

  public setState(state: State) {
    this.state = state;
    this.slice = this.state.selection;
  }

  _render() {
    let content: TemplateResult;
    if(this.slice) {
      content = html`
        <style>
          .wrap {
            height: 100px;
            padding: 10px 15px;
          }
        </style>
        
          <b>${this.slice.title}</b><br />
          Start: ${this.slice.start} ns<br />
          End: ${this.slice.end} ns
        </div>
      `;
    }
    else {
      content = html`  `;
    }

    return html`
    <style>
    :host {
      display: block;
      box-sizing: border-box;
    }
    .wrap {
      box-sizing: border-box;
      background: #73a6ff;
      transition: height 200ms ease;
      height: 0;
      width: ${this.width}px;
      position: fixed;
      bottom: 0;
      display: block;
      /*will-change: transform;*/
    }
    </style>
    <div class="wrap">
      ${content}
    </div>
    `;
  }
}

customElements.define('slice-detail-panel', SideDetailPanel);

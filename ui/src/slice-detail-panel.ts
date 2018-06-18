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
    console.log(this.slice);
  }

  _render() {
    let content: TemplateResult;
    if(this.slice) {
      content = html`
        <div class="wrap">
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
      height: ${this.height}px;
      width: ${this.width}px;
      display: block;
      box-sizing: border-box;
      position: fixed;
      bottom: 0;
    }
    .wrap {
      height: 100%;
      background: #73a6ff;
      padding: 10px 15px;
      box-sizing: border-box;
    }
    </style>
    ${content}
    `;
  }
}

customElements.define('slice-detail-panel', SideDetailPanel);

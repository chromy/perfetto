import {LitElement, html} from '@polymer/lit-element';
import {State, TrackSlice} from './backend/state';
import {TemplateResult} from 'lit-html';
import {traceDataStore} from './trace-data-store';

export class SideDetailPanel extends LitElement {
  public height: number = 50;
  private slice: TrackSlice|undefined;

  constructor(private state: State, private width: number)
  {
    super();

    this.setState(this.state);
  }

  public setState(state: State) {
    this.state = state;


    if(this.state.selection) {
      this.slice = this.getSlice(this.state.selection);
    }
  }

  private getSlice(sliceId: string): TrackSlice|undefined {
    return traceDataStore.getSlice({
      sliceId: sliceId,
      process: 1,
      thread: 1
    });

  }

  _render() {
    let content: TemplateResult;
    if(this.slice) {
      content = html`
        <div class="wrap">
          ${this.slice.title}<br />
          Start: ${this.slice.start} ns
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
      bottom: 25px;
    }
    .wrap {
      height: 100%;
      background: #73a6ff;
      padding: 5px 10px;
      border-radius: 5px;
      margin: 8px;
    }
    </style>
    ${content}
    `;
  }
}

customElements.define('slice-detail-panel', SideDetailPanel);

import {LitElement, html} from '@polymer/lit-element';
import {State} from './state';

export class GlobalBrushTimeline extends LitElement {

  constructor(private state: State)
  {
    super();

    console.log(this.state);
  }

  _render() {
    return html`<svg style="width: 100%; background:#ccc">
      <text y="20" x="10">Global Brush Timeline</text>
    </svg>`;
  }

}

customElements.define('global-brush-timeline', GlobalBrushTimeline);
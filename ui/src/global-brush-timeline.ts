import {LitElement, html} from '@polymer/lit-element';

export class GlobalBrushTimeline extends LitElement {

  static get properties() { return { mood: String }}

  _render() {
    return html`<svg style="width: 100%; background:#ccc"><text y="20" x="10">Global Brush Timeline</text></svg>`;
  }

}

customElements.define('global-brush-timeline', GlobalBrushTimeline);
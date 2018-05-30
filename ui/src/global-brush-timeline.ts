import {LitElement, html} from '@polymer/lit-element';

class GlobalBrushTimeline extends LitElement {

  static get properties() { return { mood: String }}

  _render() {
    return html`<h2>Global Brush Timeline</h2>`;
  }

}

customElements.define('global-brush-timeline', GlobalBrushTimeline);
import {LitElement, html} from '@polymer/lit-element';
import {State} from '../backend/state';

export class FramesTimeline extends LitElement {

  constructor(private state: State)
  {
    super();

    console.log(this.state);
  }

  _render() {
    return html`
    <style>
      .wrap {
        position: relative;
        height: 100px;
      }
      svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background:green;
      }
    </style>
    <div class="wrap">
      <svg>
        <text y="20" x="10">Frames Timeline</text>
      </svg>
      <slot></slot>
    </div>`;
  }

}

customElements.define('frames-timeline', FramesTimeline);

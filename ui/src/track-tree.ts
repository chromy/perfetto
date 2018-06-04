import {LitElement, html} from '@polymer/lit-element';
import {Track} from './track';
import { TrackTreeState, TrackState } from './state'
import { TrackCanvasContext } from './track-canvas-controller';

export class TrackTree extends LitElement {
  trackChildren: (TrackTree|Track)[] = [];

  static get properties() { return { state: String, trackChildren: [String] }}

  constructor(private state: TrackTreeState,
              private tCtx: TrackCanvasContext)
  {
    super();

    this.updateChildren();
  }

  private updateChildren() {
    for(let childState of this.state.children)
    {
      const child = TrackTree.isTrackTreeState(childState) ?
        new TrackTree(childState, this.createTrackCtx(5, 10)) :
        new Track(childState, this.createTrackCtx(5, 10));

      this.trackChildren.push(child);
    }
  }

  static isTrackTreeState(state: (TrackTreeState | TrackState)): state is TrackTreeState {
    return 'children' in state;
  }

  get height() : number {
    return 100;
  }

  private createTrackCtx(xOfffset: number, yOffset: number)
  {
    return new TrackCanvasContext(this.tCtx, xOfffset, yOffset);
  }

  _render({state, trackChildren}) {
    return html`<div style="background: ${state.metadata.shellColor};padding: 20px">
      <h2>Track Tree: ${state.metadata.name}</h2>
      ${trackChildren}
    </div>`;
  }
}

customElements.define('track-tree', TrackTree);

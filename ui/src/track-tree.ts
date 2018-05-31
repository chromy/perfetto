import {LitElement, html} from '@polymer/lit-element';
import {Track} from './track';
import { TrackTreeState, TrackState } from './state'

export class TrackTree extends LitElement {
  trackChildren: (TrackTree|Track)[] = [];

  static get properties() { return { state: String, trackChildren: [String] }}

  constructor(private state: TrackTreeState,
              private ctx: CanvasRenderingContext2D)
  {
    super();

    this.updateChildren();
  }

  private updateChildren() {
    for(let childState of this.state.children)
    {
      const child = TrackTree.isTrackTreeState(childState) ?
          new TrackTree(childState, this.createMCtx(10)) : new Track(childState);

      this.trackChildren.push(child);
    }
  }

  static isTrackTreeState(state: (TrackTreeState | TrackState)): state is TrackTreeState {
    return 'children' in state;
  }

  get height() : number {
    return 100;
  }

  private createMCtx(offset: number)
  {
    //TODO: Use offset.
    this.ctx.translate(0, offset);
    return this.ctx;
  }

  _render({state, trackChildren}) {
    return html`<div style="background: ${state.metadata.shellColor};padding: 20px">
      <h2>Track Tree: ${state.metadata.name}</h2>
      ${trackChildren}
    </div>`;
  }
}

customElements.define('track-tree', TrackTree);

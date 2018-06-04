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

    let yOffset = this.selfHeightTop;

    for(let childState of this.state.children)
    {
      const tCtx = this.createTrackCtx(20, yOffset);

      const child = TrackTree.isTrackTreeState(childState) ?
        new TrackTree(childState, tCtx) :
        new Track(childState, tCtx);

      this.trackChildren.push(child);

      yOffset += child.height;
    }
  }

  static isTrackTreeState(state: (TrackTreeState | TrackState)): state is TrackTreeState {
    return 'children' in state;
  }

  get height() : number {
    return this.selfHeight + this.trackChildren.map(c => c.height).reduce((a,b) => a+b, 0);
  }

  get selfHeight() : number {
    return this.selfHeightTop + this.selfHeightBottom;
  }

  get selfHeightTop() : number {
    return 92;
  }

  get selfHeightBottom() : number {
    return 20;
  }

  private createTrackCtx(xOffset: number, yOffset: number)
  {
    return new TrackCanvasContext(this.tCtx, xOffset, yOffset);
  }

  _render({state, trackChildren}) {
    return html`
    <div style="background: ${state.metadata.shellColor};padding: 20px"
      on-click=${(e) => {console.log(state.metadata.name, this.height); e.stopPropagation(); } }>
      <h2>Track Tree: ${state.metadata.name}</h2>
      ${trackChildren}
    </div>`;
  }
}

customElements.define('track-tree', TrackTree);

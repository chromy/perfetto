import {LitElement, html} from '@polymer/lit-element';
import {Track} from './track';
import {TrackTreeState, TrackState, State} from './state'
import { TrackCanvasContext } from './track-canvas-controller';

export class TrackTree extends LitElement {
  trackChildren: (TrackTree|Track)[] = [];

  static get properties() { return { state: String, trackChildren: [String] }}

  constructor(private state: TrackTreeState,
              private globalState: State,
              private tCtx: TrackCanvasContext,
              private width: number)
  {
    super();

    this.updateChildren();
  }

  private updateChildren() {

    let yOffset = this.contentPosition.top;

    for(let childState of this.state.children)
    {
      const tCtx = this.createTrackCtx(this.contentPosition.left, yOffset);

      const sidePadding = this.contentPosition.left + this.contentPosition.right;
      const reducedWidth = this.width - sidePadding;
      const child = TrackTree.isTrackTreeState(childState) ?
        new TrackTree(childState, this.globalState, tCtx, reducedWidth) :
        new Track(childState, this.globalState, tCtx, reducedWidth);

      tCtx.setDimensions(reducedWidth, child.height);
      this.trackChildren.push(child);

      yOffset += child.height;
    }
  }

  static isTrackTreeState(state: (TrackTreeState | TrackState)): state is TrackTreeState {
    return 'children' in state;
  }

  get height() : number {
    const childrenHeight = this.trackChildren
        .map(c => c.height).reduce((a,b) => a+b, 0);
    return this.contentPosition.top + childrenHeight + this.contentPosition.bottom;
  }

  get contentPosition() : { top: number, right: number, bottom: number, left: number } {
    return { top: 92, right: 10, bottom: 20, left: 10 };
  }

  private createTrackCtx(xOffset: number, yOffset: number)
  {
    return new TrackCanvasContext(this.tCtx, xOffset, yOffset);
  }

  _render({state, trackChildren}:
              {state: TrackTreeState, trackChildren: (TrackTree|Track)[]}) {
    for(const child of trackChildren)
    {
      //TODO: This is an ugly way of propagating changes.
      child._invalidateProperties();
    }

    return html`
    <style>
      .wrap {
        background: ${state.metadata.shellColor};
        padding: 20px;
        height: ${this.height}px;
        box-sizing: border-box;
        position: relative;
      }
      .content {
        position: absolute;
        top: ${this.contentPosition.top}px;
        left: ${this.contentPosition.left}px;
        width: ${this.width - 
    this.contentPosition.left - this.contentPosition.right + 'px'};
      }
    </style>
    <div class="wrap">
      <h2>Track Tree: ${state.metadata.name}</h2>
      <div class="content">
        ${trackChildren}
      </div>
    </div>`;
  }
}

customElements.define('track-tree', TrackTree);

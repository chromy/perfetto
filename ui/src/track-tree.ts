import {LitElement, html} from '@polymer/lit-element';
import {Track} from './track';
import {TrackTreeState, TrackState } from './backend/state'
import { TrackCanvasContext } from './track-canvas-controller';
import {OffsetTimeScale} from './time-scale';

export class TrackTree extends LitElement {
  trackChildren: (TrackTree|Track)[] = [];

  static get properties() { return { state: String, trackChildren: [String] }}

  constructor(private state: TrackTreeState,
              private tCtx: TrackCanvasContext,
              private width: number,
              private scale: OffsetTimeScale)
  {
    super();

    this.updateChildren();
  }

  private updateChildren() {

    let yOffset = this.contentPosition.top + 1;  // 1px for border.

    for(let childState of this.state.children)
    {
      const tCtx = this.createTrackCtx(this.contentPosition.left, yOffset);

      const sidePadding = this.contentPosition.left + this.contentPosition.right;
      const reducedWidth = this.width - sidePadding;
      const cScale = new OffsetTimeScale(this.scale,
          this.contentPosition.left,
          reducedWidth);

      const child = TrackTree.isTrackTreeState(childState) ?
        new TrackTree(childState, tCtx, reducedWidth, cScale) :
        new Track(childState, tCtx, reducedWidth, cScale);

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

    // TODO: Do colors based on nesting level.
    return html`
    <style>
      .wrap {
        background-color: hsla(213, 100%, 98%, 50%);
        height: ${this.height}px;
        box-sizing: border-box;
        position: relative;
        width: ${this.width}px;
        border: 1px solid #777; 
      }
      .content {
        position: absolute;
        top: ${this.contentPosition.top}px;
        left: ${this.contentPosition.left}px;
        width: ${this.width - 
    this.contentPosition.left - this.contentPosition.right + 'px'};
      }
      .titlebar {
        background-color: #e5eef7;
        padding: 5px;
      }
    </style>
    <div class="wrap">
      <div class="titlebar">${state.metadata.name}</div>
      <div class="content">
        ${trackChildren}
      </div>
    </div>`;
  }
}

customElements.define('track-tree', TrackTree);

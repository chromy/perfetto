import {LitElement, html} from '@polymer/lit-element';
import {Track} from './track';
import {TrackTreeState, TrackState, GlobalPositioningState} from './backend/state'
import { TrackCanvasContext } from './track-canvas-controller';
import {OffsetTimeScale} from './time-scale';

export class TrackTree extends LitElement {
  trackTreeChildren: TrackTree[] = [];
  trackChildren: Track[] = [];

  static get properties() { return { state: String, trackChildren: [String] }}

  constructor(private state: TrackTreeState,
              private tracks: {[id: string]: TrackState},
              private tCtx: TrackCanvasContext,
              private width: number,
              private scale: OffsetTimeScale,
              private gps: GlobalPositioningState) {
    super();

    this.updateChildren();
  }

  private updateChildren() {

    const sidePadding = this.contentPosition.left + this.contentPosition.right;
    const reducedWidth = this.width - sidePadding;
    const cScale = new OffsetTimeScale(this.scale, this.contentPosition.left,
        reducedWidth);
    let yOffset = this.contentPosition.top + 1;  // 1px for border.

    if (this.state.children) {
      let i = -1;
      for (let childState of this.state.children) {
        i++;
        let child: TrackTree;
        if (this.trackTreeChildren[i]) {
          //TODO: This matching of TrackTrees should be done intelligently.
          child = this.trackTreeChildren[i];
          child.setState(childState, this.tracks, this.gps);
        }
        else {
          const tCtx = this.createTrackCtx(this.contentPosition.left, yOffset);

          child = new TrackTree(childState, this.tracks, tCtx, reducedWidth,
              cScale, this.gps);

          tCtx.setDimensions(reducedWidth, child.height);
          this.trackTreeChildren.push(child);
        }

        yOffset += child.height;
      }
    }

    if (this.state.trackIds) {
      let i = -1;
      for (let trackId of this.state.trackIds) {
        i++;
        const trackState = this.tracks[trackId];
        let child: Track;
        if (this.trackChildren[i]) {
          //TODO: This matching of Tracks should be done intelligently.
          child = this.trackChildren[i];
          child.setState(trackState, this.gps);
        }
        else {
          const tCtx = this.createTrackCtx(this.contentPosition.left, yOffset);

          child = new Track(trackState, tCtx, reducedWidth, cScale, this.gps);
          tCtx.setDimensions(reducedWidth, child.height);
          this.trackChildren.push(child);
        }

        yOffset += child.height;
      }
    }
  }

  public setState(state: TrackTreeState, tracks: {[id: string]: TrackState}, gps: GlobalPositioningState) {
    this.state = state;
    this.tracks = tracks;
    this.gps = gps;

    this.updateChildren();
  }

  static isTrackTreeState(state: (TrackTreeState | TrackState)): state is TrackTreeState {
    return 'children' in state;
  }

  get height() : number {
    const trackTreeChildrenHeight = this.trackTreeChildren
        .map(c => c.height).reduce((a,b) => a+b, 0);
    const trackChildrenHeight = this.trackChildren
        .map(c => c.height).reduce((a,b) => a+b, 0);
    return this.contentPosition.top + trackTreeChildrenHeight +
        trackChildrenHeight + this.contentPosition.bottom;
  }

  get contentPosition() : { top: number, right: number, bottom: number, left: number } {
    return { top: 92, right: 10, bottom: 20, left: 10 };
  }

  private createTrackCtx(xOffset: number, yOffset: number) {
    return new TrackCanvasContext(this.tCtx, xOffset, yOffset);
  }

  _render({state, trackChildren}:
              {state: TrackTreeState, trackChildren: (TrackTree|Track)[]}) {
    for(const child of trackChildren) {
      //TODO: This is an ugly way of propagating changes.
      child._invalidateProperties();
    }
    for(const child of this.trackTreeChildren) {
      child._invalidateProperties();
    }


    // TODO: Do colors based on nesting level.
    return html`
    <style>
      .wrap {
        background-color: hsla(213, 100%, 98%, 0.50);
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
        ${this.trackTreeChildren}
        ${this.trackChildren}
      </div>
    </div>`;
  }
}

customElements.define('track-tree', TrackTree);

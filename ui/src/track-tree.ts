import { LitElement, html } from '@polymer/lit-element';
import { GlobalPositioningState, TrackNodeID, TrackState, TrackTreeState } from './backend/state';
import { OffsetTimeScale } from './time-scale';
import { Track } from './track';
import { TrackCanvasContext } from './track-canvas-controller';

export class TrackTree extends LitElement {
  private idToChildTrackTrees: Map<string, TrackTree>;
  private idToChildTracks: Map<string, Track>;

  static get properties() { return { }}

  constructor(private trackTreeState: TrackTreeState,
              private tracks: {[id: string]: TrackState},
              private trackTrees: {[id: string]: TrackTreeState},
              private tCtx: TrackCanvasContext,
              private width: number,
              private scale: OffsetTimeScale,
              private gps: GlobalPositioningState) {
    super();
    this.idToChildTracks = new Map();
    this.idToChildTrackTrees = new Map();
    this.updateChildren();
  }

  private getNodeHeight(nodeID: TrackNodeID) : number {
    if (nodeID.nodeType === 'TRACK') {
      const track = this.tracks[nodeID.id];
      if (track == null) throw 'Non-existent track';
      return track.height;
    }
    
    // Else, it's a tracktree.
    const trackTree = this.trackTrees[nodeID.id];
    const childrenHeight = trackTree.children
        .map(c => this.getNodeHeight(c))
        .reduce((a,b) => a+b, 0);

    // TODO: Remove references to contentPosition in here.
    // This should be all constants.
    return this.contentPosition.top + childrenHeight
      + this.contentPosition.bottom;
  }

  private updateChildren() {

    const sidePadding = this.contentPosition.left + this.contentPosition.right;
    const reducedWidth = this.width - sidePadding;
    const cScale = new OffsetTimeScale(this.scale, this.contentPosition.left,
        reducedWidth);
    let yOffset = this.contentPosition.top + 1;  // 1px for border.
    
    for (const childID of this.trackTreeState.children) {
      switch (childID.nodeType) {
        case 'TRACK': {  // Intentionally using new block.
          const childState = this.tracks[childID.id];
          const child = this.idToChildTracks.get(childID.id);
          if (child == null) {
            const childTrackCtx = this.createTrackCtx(this.contentPosition.left, yOffset);
            this.idToChildTracks.set(childID.id,
              new Track(childState, childTrackCtx, reducedWidth, cScale, this.gps));
          } else {
            child.setState(childState, this.gps);
          }
          break;
        }
        case 'TRACKTREE': {
          // TODO: Lots of code duplication with the block above.
          const childState = this.trackTrees[childID.id];
          const child = this.idToChildTrackTrees.get(childID.id);
          if (child == null) {
            const childTrackCtx = this.createTrackCtx(this.contentPosition.left, yOffset);
            this.idToChildTrackTrees.set(childID.id,
              // TODO: Constructor takes in way too many things. Refactor.
              new TrackTree(childState, this.tracks, this.trackTrees,
                childTrackCtx, reducedWidth, cScale, this.gps));
          } else {
            child.setState(childState, this.tracks, this.trackTrees, this.gps);
          }
          break;
        }
      }
          
      yOffset += this.getNodeHeight(childID);
    }
  }

  public setState(
      state: TrackTreeState,
      tracks: {[id: string]: TrackState},
      trackTrees: {[id: string]: TrackTreeState},
      gps: GlobalPositioningState) {
    this.trackTreeState = state;
    this.tracks = tracks;
    this.trackTrees = trackTrees;
    this.gps = gps;
    this.updateChildren();
  }

  static isTrackTreeState(state: (TrackTreeState | TrackState)): state is TrackTreeState {
    return 'children' in state;
  }

  get height() : number {
    // TODO: This and getNodeHeight has duplicated code.
    const childrenHeight = this.trackTreeState.children
        .map(c => this.getNodeHeight(c))
        .reduce((a,b) => a+b, 0);

    // TODO: Remove references to contentPosition in here.
    // This should be all constants.
    return this.contentPosition.top + childrenHeight
      + this.contentPosition.bottom;
  }

  get contentPosition() : { top: number, right: number, bottom: number, left: number } {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  private createTrackCtx(xOffset: number, yOffset: number) {
    return new TrackCanvasContext(this.tCtx, xOffset, yOffset);
  }

  _render() {
    //TODO: This is an ugly way of propagating changes.
    for(const child of this.idToChildTracks.values()) {
      child._invalidateProperties();
    }

    for (const child of this.idToChildTrackTrees.values()) {
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
      <div class="titlebar">${this.trackTreeState.name}</div>
      <div class="content">
        ${this.trackTreeState.children.map(
          childID => childID.nodeType === 'TRACK' ?
            this.idToChildTracks.get(childID.id) :
            this.idToChildTrackTrees.get(childID.id))
        }
      </div>
    </div>`;
  }
}

customElements.define('track-tree', TrackTree);

import {LitElement, html} from '@polymer/lit-element';
import {Track} from './track';
import { TrackTreeState, TrackState } from './state'

export class TrackTree extends LitElement {
  trackChildren: (TrackTree|Track)[] = [];
  s: TrackTreeState | undefined;
  ctx: CanvasRenderingContext2D | undefined;

  static get properties() { return { s: String, trackChildren: [String] }}

  constructor(state?: TrackTreeState)
  {
    super();

    if(state)
    {
      this.state = state;
    }
  }

  set context(context: CanvasRenderingContext2D) {
    this.ctx = context;
  }

  set state(state: TrackTreeState) {
    this.s = state;

    console.log(state);

    // Define children
    for(let childState of this.s.children)
    {
      const child = TrackTree.isTrackTreeState(childState) ?
          new TrackTree(childState) : new Track(childState);

      this.trackChildren.push(child);
    }
  }

  static isTrackTreeState(state: (TrackTreeState | TrackState)): state is TrackTreeState {
    return 'children' in state;
  }

  get height() : number {
    return 100;
  }

  // This is not yet in use.
  render() {
    let offset =  0;
    if(!this.ctx)
    {
      throw new Error('Context not defined.');
    }
    else
    {
      let modifiedCtx = this.ctx;
      for (let c of this.trackChildren) {
        modifiedCtx = this.createMCtx(offset, modifiedCtx);
        //<c modifiedCtx/>.render();

        c.context = modifiedCtx;

        c.render();

        offset += c.height;
      }
    }
  }

  private createMCtx(offset: number, ctx: CanvasRenderingContext2D)
  {
    //TODO: Use offset.
    ctx.translate(0, offset);
    return ctx;
  }

  _render({s, trackChildren}) {
    return html`<div style="background: ${s.metadata.shellColor}; padding: 20px"><h2>Track Tree: ${s.metadata.name}</h2>
      ${trackChildren}
    </div>`;
  }
}

customElements.define('track-tree', TrackTree);

import {LitElement, html} from '@polymer/lit-element';
import {Track} from './track';
import { TrackTreeState, TrackState } from './state'

export class TrackTree extends LitElement {
  trackChildren: (TrackTree|Track)[] = [];
  s: TrackTreeState | undefined;
  ctx: CanvasRenderingContext2D | undefined;

  static get properties() { return { trackChildren: [String] }}

  constructor()
  {
    super();
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
      if(this.isTrackTreeState(childState))
      {
        const child = new TrackTree();
        child.state = childState;
        this.trackChildren.push(child);
      }
      else
      {
        const child = new Track();
        child.state = childState;
        this.trackChildren.push(child);
      }
    }
  }

  isTrackTreeState(state: (TrackTreeState | TrackState)): state is TrackTreeState {
    return 'children' in state;
  }

  get height() : number {
    return 100;
  }
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

  _render({trackChildren}) {
    console.log(trackChildren);
    return html`<div><h2>Track Tree</h2>
      ${trackChildren.map(c =>
        /*c instanceof TrackTree ? html`<track-tree></track-tree>` :
            `<trace-track></trace-track>`*/
        c
      )}
    </div>`;
  }
}

customElements.define('track-tree', TrackTree);

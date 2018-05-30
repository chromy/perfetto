import {LitElement, html} from '@polymer/lit-element';
import {Track} from './track';

export class TrackTree extends LitElement {
  children: (TrackTree|Track)[];
  s: TrackTreeState | undefined;
  ctx: CanvasRenderingContext2D | undefined;

  constructor(children: (TrackTree|Track)[])
  {
    super();
    this.children = children;
  }

  set context(context: CanvasRenderingContext2D) {
    this.ctx = context;
  }

  set state(state: TrackTreeState) {
    this.s = state;

    // Define children etc.
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
      for (let c of this.children) {
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
    return ctx;
  }

  _render() {
    return html`<div>Track Tree
      ${this.children.map(c =>
        c instanceof TrackTree ? html`<track-tree />` : `<track />`
      )}
    </div>`;
  }
}

customElements.define('track-tree', TrackTree);

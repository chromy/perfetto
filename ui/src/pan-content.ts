import {LitElement, html} from '@polymer/lit-element';
import {State} from './state';
import {render} from 'lit-html';

export class PanContent extends LitElement {

  protected mouseDownX = -1;
  protected timeToWidthRatio : number;
  private scroller: HTMLDivElement;

  static MAX_SCROLL = 600;
  static SCROLL_BAR_HEIGHT = 16;
  static NEUTRAL_POSITION = PanContent.MAX_SCROLL / 2;

  constructor(private width: number,
              private height: number,
              private state: State,
              private onPanned: () => void) {
    super();

    this.timeToWidthRatio = (this.state.gps.endVisibleWindow -
        this.state.gps.startVisibleWindow) / this.width;

    this.scroller = document.createElement('div');
    this.scroller.className = 'scroller';
    this.scroller.addEventListener('scroll', () => this.onScroll());
  }

  protected onMouseDown(e: MouseEvent) {
    this.mouseDownX = e.clientX;
  }

  protected onMouseMove(e: MouseEvent) {
    if(this.mouseDownX !== -1) {
      const movedPx = this.mouseDownX - e.clientX;
      this.panByPx(movedPx);
      this.mouseDownX = e.clientX;
    }
  }

  protected onMouseUp() {
    this.mouseDownX = -1;
  }

  protected panByPx(movedPx: number) {
    const movedTime = this.timeToWidthRatio * movedPx;

    this.state.gps.startVisibleWindow += movedTime;
    this.state.gps.endVisibleWindow += movedTime;

    this.onPanned();
  }

  protected onScroll() {
    const scrollX = this.scroller.scrollLeft;
    if(scrollX) {
      const movedPx = scrollX - PanContent.NEUTRAL_POSITION;
      this.scroller.scrollLeft = PanContent.NEUTRAL_POSITION;

      this.panByPx(movedPx);
    }
  }

  _firstRendered() {
    this.scroller.scrollLeft = PanContent.NEUTRAL_POSITION;
  }

  _render() {

    this.timeToWidthRatio = (this.state.gps.endVisibleWindow -
        this.state.gps.startVisibleWindow) / this.width;

    const scrollerContent = html`
    <style>
    .overflow-content {
        width: ${this.width + PanContent.MAX_SCROLL + 'px'};
        height: 1px;
      }
      .scroller-content {
        width: ${this.width + 'px'};
        position: relative;
        left: ${PanContent.NEUTRAL_POSITION + 'px'};
      }
    </style>
    <div class="overflow-content"></div>
    <div class="scroller-content">
      <slot></slot>
    </div>
    `;

    render(scrollerContent, this.scroller);

    return html`<style>
      :host {
        width: ${this.width}px;
        height: ${this.height}px;
        overflow: hidden;
        z-index: 100;
      }
      .event-capture {
        width: ${this.width}px;
        height: ${this.height}px;
        position: relative;
        overflow: hidden;
      }
      .scroller {
        overflow-x: scroll;
        overflow-y: hidden;
        width: ${this.width + 'px'};
        height: ${this.height + PanContent.SCROLL_BAR_HEIGHT}px;
      }
    </style>
    <div class="event-capture"
           on-mousedown=${(e: MouseEvent) => { this.onMouseDown(e); } }
           on-mousemove=${(e: MouseEvent) => { this.onMouseMove(e); } }
           on-mouseup=${() => { this.onMouseUp(); } }>
      ${this.scroller}
    </div>`;
    //<track-tree tree=rootTree modifiedCtx=cc.getCanvasContext('2D')/>
  }

}

customElements.define('pan-content', PanContent);

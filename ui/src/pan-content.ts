import {LitElement, html} from '@polymer/lit-element';
import {State} from './state';
import {render} from 'lit-html';

export class PanContent extends LitElement {

  static MAX_SCROLL = 600;
  static SCROLL_BAR_HEIGHT = 16;
  static NEUTRAL_POSITION = PanContent.MAX_SCROLL / 2;
  static SCROLL_SPEED = 10;

  protected mouseDownX = -1;
  protected timeToWidthRatio : number;
  private scroller: HTMLDivElement;
  private lastScrollX = PanContent.NEUTRAL_POSITION;

  constructor(private width: number,
              private windowHeight: number,
              private state: State,
              private onPanned: () => void,
              private onScrolled: (scrollTop: number) => void) {
    super();

    this.timeToWidthRatio = (this.state.gps.endVisibleWindow -
        this.state.gps.startVisibleWindow) / this.width;

    this.scroller = document.createElement('div');
    this.scroller.className = 'scroller';
    this.scroller.addEventListener('scroll', () => this.onScroll(), {passive: true});
    this.scroller.scrollLeft = PanContent.NEUTRAL_POSITION;
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

    /*const start = Date.now();
    let i = 0;
    while(Date.now() - start < 200)
    {
      i++;
    }
    console.log(i);*/

    const movedPx = this.scroller.scrollLeft - this.lastScrollX;
    if(movedPx) {
      this.panByPx(movedPx * PanContent.SCROLL_SPEED);
      this.lastScrollX = this.scroller.scrollLeft;
    }

    this.onScrolled(this.scroller.scrollTop);
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
        left: ${this.scroller.scrollLeft + 'px'};
      }
    </style>
    <div class="overflow-content"></div>
    <div class="scroller-content">
      <slot></slot>
    </div>
    `;

    render(scrollerContent, this.scroller);

    return html`<style>
      .event-capture {
        width: ${this.width}px;
        height: ${this.windowHeight}px;
        overflow: hidden;
      }
      .scroller {
        overflow: scroll;
        width: ${this.width + 'px'};
        height: ${this.windowHeight + PanContent.SCROLL_BAR_HEIGHT}px;
      }
    </style>
    <div class="event-capture"
           on-mousedown=${(e: MouseEvent) => { this.onMouseDown(e); } }
           on-mousemove=${(e: MouseEvent) => { this.onMouseMove(e); } }
           on-mouseup=${() => { this.onMouseUp(); } }>
      ${this.scroller}
    </div>`;
  }

}

customElements.define('pan-content', PanContent);

import {LitElement, html} from '@polymer/lit-element';
import {State} from './state';
import {render} from 'lit-html';

export class PanContent extends LitElement {

  static SCROLL_SPEED = 1;
  static SCROLLBAR_WIDTH = 16;

  protected mouseDownX = -1;
  protected timeToWidthRatio : number;
  private scroller: HTMLDivElement;

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
    this.scroller.addEventListener('wheel', (e) => this.onWheel(e));
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

  protected onWheel(e: WheelEvent) {

    /*const start = Date.now();
    let i = 0;
    while(Date.now() - start < 200)
    {
      i++;
    }
    console.log(i);*/

    if(e.deltaX) {
      this.panByPx(e.deltaX * PanContent.SCROLL_SPEED);
    }

    this.onScrolled(this.scroller.scrollTop);
  }

  _render() {

    this.timeToWidthRatio = (this.state.gps.endVisibleWindow -
        this.state.gps.startVisibleWindow) / this.width;

    const scrollerContent = html`
    <style>
      .scroller-content {
        width: ${this.width - PanContent.SCROLLBAR_WIDTH + 'px'};
        position: relative;
      }
    </style>
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
        overflow-y: scroll;
        overflow-x: hidden;
        width: ${this.width + 'px'};
        height: ${this.windowHeight}px;
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

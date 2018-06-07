import {LitElement, html} from '@polymer/lit-element';
import {State} from './state';
//import {html} from 'lit-html/lib/lit-extended';

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
    const overflowContent = document.createElement('div');
    overflowContent.className = 'overflow-content';
    this.scroller.appendChild(overflowContent);
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

    return html`<style>
      :host {
        position: fixed;
        top: 0;
        left: 0;
        width: ${this.width}px;
        height: ${this.height}px;
        overflow: hidden;
        z-index: 100;
      }
      .event-capture {
        width: ${this.width}px;
        height: ${this.height + PanContent.SCROLL_BAR_HEIGHT}px;
        position: relative;
      }
      .scroller {
        overflow-x: scroll;
        width: ${this.width}px;
        height: ${this.height + PanContent.SCROLL_BAR_HEIGHT}px;
      }
      .overflow-content {
        width: ${this.width + PanContent.MAX_SCROLL + 'px'};
        height: 1px;
      }
    </style>
    <div class="event-capture" on-mousedown=${(e: MouseEvent) => { this.onMouseDown(e); } }
           on-mousemove=${(e: MouseEvent) => { this.onMouseMove(e); } }
           on-mouseup=${() => { this.onMouseUp(); } }>
      ${this.scroller}
    </div>`;
    //<track-tree tree=rootTree modifiedCtx=cc.getCanvasContext('2D')/>
  }

}

customElements.define('pan-content', PanContent);

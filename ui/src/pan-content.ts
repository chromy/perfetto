import {LitElement, html} from '@polymer/lit-element';
import {State} from './state';
import {render} from 'lit-html';
import {TimeScale} from './time-scale';

export class PanContent extends LitElement {

  static SCROLL_SPEED = 1;
  static SCROLLBAR_WIDTH = 16;
  static ZOOM_IN_PERCENTAGE_SPEED = 0.95;
  static ZOOM_OUT_PERCENTAGE_SPEED = 1.05;

  protected mouseDownX = -1;
  private scroller: HTMLDivElement;
  private mouseXpos: number = 0;

  constructor(private width: number,
              private windowHeight: number,
              private state: State,
              private scale: TimeScale,
              private onPanned: () => void,
              private onScrolled: (scrollTop: number) => void) {
    super();

    this.scroller = document.createElement('div');
    this.scroller.className = 'scroller';
    this.scroller.addEventListener('wheel', (e) => this.onWheel(e));

    this.handleZooming();
  }

  protected handleZooming() {

    let zooming = false;

    document.body.addEventListener('keydown', (e) => {
      if(e.key === 'w') {
        startZoom(true);
      } else if(e.key === 's') {
        startZoom(false);
      }
    });
    document.body.addEventListener('keyup', (e) => {
      if(e.key === 'w' || e.key === 's') {
        endZoom();
      }
    });

    const zoom = (zoomIn: boolean) => {
      const t = this.state.gps.endVisibleWindow - this.state.gps.startVisibleWindow;
      const percentage = zoomIn ? PanContent.ZOOM_IN_PERCENTAGE_SPEED :
          PanContent.ZOOM_OUT_PERCENTAGE_SPEED;
      const newT = t * percentage;

      const zoomPosition = this.scale.pxToTs(this.mouseXpos);
      //const zoomPosition = t / 2 + this.state.gps.startVisibleWindow;
      const zoomPositionPercentage = (zoomPosition -
          this.state.gps.startVisibleWindow) / t;

      this.state.gps.startVisibleWindow = zoomPosition - newT * zoomPositionPercentage;
      this.state.gps.endVisibleWindow = zoomPosition + newT * (1 - zoomPositionPercentage);

      this.onPanned();

      if(zooming) {
        requestAnimationFrame(() => zoom(zoomIn));
      }
    };

    const startZoom = (zoomIn: boolean) => {
      zooming = true;
      zoom(zoomIn);
    };
    const endZoom = () => {
      zooming = false;
    };
  }

  protected onMouseDown(e: MouseEvent) {
    this.mouseDownX = e.offsetX;
  }

  protected onMouseMove(e: MouseEvent) {
    if(this.mouseDownX !== -1) {
      const movedPx = this.mouseDownX - e.offsetX;
      this.panByPx(movedPx);
      this.mouseDownX = e.offsetX;
    }
    this.mouseXpos = e.offsetX;
    //console.log(this.mouseXpos, this.scale.pxToTs(this.mouseXpos));
  }

  protected onMouseUp() {
    this.mouseDownX = -1;
  }

  protected panByPx(movedPx: number) {
    const movedTime = this.scale.pxToTs(movedPx) - this.scale.pxToTs(0);

    this.state.gps.startVisibleWindow += movedTime;
    this.state.gps.endVisibleWindow += movedTime;

    this.onPanned();
  }

  protected onWheel(e: WheelEvent) {

    if(e.deltaX) {
      this.panByPx(e.deltaX * PanContent.SCROLL_SPEED);
    }

    this.onScrolled(this.scroller.scrollTop);
  }

  _render() {

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
        will-change: transform;
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

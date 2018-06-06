import {LitElement, html} from '@polymer/lit-element';
import {State} from './state';
//import {html} from 'lit-html/lib/lit-extended';

export class PanContent extends LitElement {

  protected mouseDownX = -1;
  protected timeToWidthRatio : number;

  constructor(private width: number,
              private height: number,
              private state: State,
              private onPanned: () => void) {
    super();

    this.timeToWidthRatio = (this.state.gps.endVisibleWindow -
        this.state.gps.startVisibleWindow) / this.width;

    window.addEventListener('scroll', (e: UIEvent) => this.onScroll(e));
  }

  protected onMouseDown(e: MouseEvent) {
    this.mouseDownX = e.clientX;
  }

  protected onMouseMove(e: MouseEvent) {
    if(this.mouseDownX !== -1) {
      const movedPx = this.mouseDownX - e.clientX;
      const movedTime = this.timeToWidthRatio * movedPx;

      this.state.gps.startVisibleWindow += movedTime;
      this.state.gps.endVisibleWindow += movedTime;

      this.onPanned();
      this.mouseDownX = e.clientX;
    }
  }

  protected onMouseUp() {
    this.mouseDownX = -1;
  }

  protected onScroll(e: UIEvent) {
    //console.log(e);
    if(PanContent.isMouseWheelEvent(e))
    {
      if(e.deltaX) {
        const total = this.state.gps.endVisibleWindow -
            this.state.gps.startVisibleWindow;

        this.state.gps.startVisibleWindow += total * 0.1;
        this.state.gps.endVisibleWindow += total * 0.1;
      }
    }

  }

  static isMouseWheelEvent(e: UIEvent): e is MouseWheelEvent {
    return 'deltaX' in e;
  }

  _render() {

    this.timeToWidthRatio = (this.state.gps.endVisibleWindow -
        this.state.gps.startVisibleWindow) / this.width;

    return html`<style>
      :host {
        position: absolute;
        top: 0;
        left: 0;
      }
      .event-capture {
        width: ${this.width}px;
        height: ${this.height}px;
        z-index: 100;
        position: relative;
      }
    </style>
    
    <div class="event-capture"
         on-mousedown=${(e: MouseEvent) => { this.onMouseDown(e); } }
         on-mousemove=${(e: MouseEvent) => { this.onMouseMove(e); } }
         on-mouseup=${() => { this.onMouseUp(); } }
        >
    </div>`;
    //<track-tree tree=rootTree modifiedCtx=cc.getCanvasContext('2D')/>
  }

}

customElements.define('pan-content', PanContent);

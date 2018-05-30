export class TrackCanvasController {
  // Owns the canvas.

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor()
  {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('height', '1000');
    this.canvas.setAttribute('width', '1000');
    console.log('Canvas created.');

    //TODO: getContext can return null. Need better solution.
    this.ctx = <CanvasRenderingContext2D> this.canvas.getContext('2d');
  }

  getContext2D() {
    return this.ctx;
  }

  render() {
    //TODO: Defines height/width etc.
  }

  onResize()
  {
    //TODO
  }
}

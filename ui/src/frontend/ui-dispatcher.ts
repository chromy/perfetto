// Wrapper over gDispatch so we can access it from anywhere.
class UIDispatcher {
  public gDispatch:  (msg: any) => void = _ => {
      throw "Dispatcher not initialized";
  };

  initialize(gDispatch: (msg: any) => void): void {
      this.gDispatch = gDispatch;
  }
}

// Singleton.
export default new UIDispatcher();
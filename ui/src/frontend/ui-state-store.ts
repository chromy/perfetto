import { State, createZeroState } from '../backend/state';

// Wrapper over gState so we can access it from anywhere. In the real trace
// viewer, this is a good place to implement partial state subscription.
class UIStateStore {
  public gState: State = createZeroState();
}

// Singleton.
export default new UIStateStore();
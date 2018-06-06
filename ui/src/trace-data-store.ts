interface ThreadSlice {
  start: number,
  end: number
  title: string,
  tid: number,
  pid: number,
};

type ThreadDataMap = Map<number, ThreadSlice[]>;
type ProcessDataMap = Map<number, ThreadDataMap>;

function getFirstIndexWhereTrue(slices: ThreadSlice[],
    testFn: (slice: ThreadSlice) => Boolean) : number {
  // TODO: This should be a binary search.
  for (let i = 0; i < slices.length; i++) {
    if (testFn(slices[i])) return i;
  }
  return slices.length;
}

export class TraceDataStore {
  // TODO: This is super ad hoc. Figure out how to actually cache data properly.
  // We need to figure out what the cache keys should be, and how data
  // expiration will work (LRU?)
  private data: ProcessDataMap;

  constructor() {
    this.data = new Map();
  }

  * getData(query: TraceDataQuery) {
    if (query.process === undefined || query.thread === undefined) return;
    const process = query.process;
    const threadData = this.data.get(process);
    if (threadData == null) return;
    const slices = threadData.get(query.thread);
    if (slices == null || slices.length == 0) return;
    const beginIndex = getFirstIndexWhereTrue(slices, s => query.start < s.end);
    const endIndex  = getFirstIndexWhereTrue(slices, s => query.end < s.start);
    for (let i = beginIndex; i < endIndex; i++) {
      yield slices[i];
    }
  }

  onNewDataReceived() {
    //App.render();
  }
}

export interface TraceDataQuery {
  readonly start: number;
  readonly end: number;
  readonly process?: number;
  readonly thread?: number;
}

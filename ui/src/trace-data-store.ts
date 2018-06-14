import { State } from './backend/state';
import {Milliseconds} from './time-scale';

// TODO: Perhaps this definition should live somewhere else.
export interface ThreadSlice {
  start: number,
  end: number
  title: string,
  tid: number,
  pid: number,
}

interface ThreadSliceCache {
  // Start and end time of data that we have cached.
  start: Milliseconds;
  end: Milliseconds;

  slices: ThreadSlice[];
}

export interface TraceDataQuery {
  readonly start: number;
  readonly end: number;
  readonly process?: number;
  readonly thread?: number;
}

function queryEquals(q1: TraceDataQuery, q2: TraceDataQuery) {
  return q1.start == q2.start && 
    q1.end == q2.end &&
    q1.process == q2.process &&
    q1.thread == q2.thread;
}

type ThreadDataMap = Map<number, ThreadSliceCache>;
type ProcessDataMap = Map<number, ThreadDataMap>;

function getFirstIndexWhereTrue(slices: ThreadSlice[],
    testFn: (slice: ThreadSlice) => Boolean) : number {
  // TODO: This should be a binary search.
  for (let i = 0; i < slices.length; i++) {
    if (testFn(slices[i])) return i;
  }
  return slices.length;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

sleep;  // tsc disable unused warning.

class TraceDataStore {
  // TODO: This is super ad hoc. Figure out how to actually cache data properly.
  // We need to figure out what the cache keys should be, and how data
  // expiration will work (LRU?)
  private processDataMap: ProcessDataMap = new Map();
  private pendingQueries: TraceDataQuery[] = []; 

  constructor() {}

  initialize(stateGetter: () => State, rerenderCallback: () => any) {
    this.onNewDataReceived = rerenderCallback;
    this.state = stateGetter;
  }

  // Currently unused.
  populateWithMockData() {
    for (let pid = 1; pid < 10; pid++) {
      const threadData : ThreadDataMap = new Map();
      for (let tid = 1; tid < 10; tid++) {
        const slices : ThreadSlice[] = [];
        let nextStart = 0;
        for(let t = 0; t <= 250 && nextStart < 1000; t += 1) {
          const slice = {
            start: nextStart,
            end: nextStart + Math.round(Math.abs(Math.sin(t)*50)),
            title: 'SliceName',
            tid: tid, 
            pid: pid,
          };
          slices.push(slice);
          nextStart = slice.end + Math.round(Math.abs(Math.sin(t)*20));
        }
        threadData.set(tid, {
          start: slices[0].start,
          end: slices[slices.length - 1].end,
          slices,
        });
      }
      this.processDataMap.set(pid, threadData);
    }
  }

  * getData(query: TraceDataQuery) {
    // At the moment, we need either process or thread in the query.
    if (query.process == null || query.thread == null) return;
    const process = query.process;
    const threadData = this.processDataMap.get(process);

    if (threadData == null) {
      // If we do not have data for this process, schedule a fetch and return. 
      this.fetchDataFromBackend(query);
      return;
    }

    const cachedSlices = threadData.get(query.thread);
    if (cachedSlices == null) {
      // If we do not have data for this process, schedule a fetch and return. 
      this.fetchDataFromBackend(query);
      return;
    }

    if (query.start < cachedSlices.start || query.end > cachedSlices.end) {
      // For now reissue the whole query. We will eventually do partial query to
      // top up the cache.
      this.fetchDataFromBackend(query);
    }

    const slices = cachedSlices.slices;
    if (slices == null || slices.length == 0) return;
    const beginIndex = getFirstIndexWhereTrue(slices, s => query.start < s.end);
    const endIndex  = getFirstIndexWhereTrue(slices, s => query.end < s.start);
    for (let i = beginIndex; i < endIndex; i++) {
      yield slices[i];
    }
  }

  onNewDataReceived() {
    throw new Error("TraceDataStore must be initialized with rerender callback");
  }

  state(): State {
    throw new Error("TraceDataStore must be initialized with stateGetter");
  }

  queryPending(query: TraceDataQuery) {
    for (let pendingQuery of this.pendingQueries) {
      if (queryEquals(pendingQuery, query)) return true;
    }
    return false;
  }

  async fetchDataFromBackend(query: TraceDataQuery) {
    const queryDuration = query.end - query.start;
    const widenedQuery = {
      thread: query.thread,
      process: query.process,
      start: query.start - (0.5 * queryDuration),
      end: query.end + (0.5 * queryDuration)
    }
    if (this.queryPending(widenedQuery)) return;
    this.pendingQueries.push(widenedQuery);
    console.log("Fetching data from backend: ", query);
    // Toggle this line to introduce delay for testing.
    //    await sleep(50);
    this.mockFetchDataFromBackend(widenedQuery);
    // TODO: Implement slice eviction.
    this.onNewDataReceived();
  }

  // Currently unused.
  checkCacheHit(query: TraceDataQuery) {
    if (query.process == null || query.thread == null) return false;
    const threadData = this.processDataMap.get(query.process);    
    if (threadData == null) return false;
    const cachedSlices = threadData.get(query.thread);
    if (cachedSlices == null) return false;
    return (query.start >= cachedSlices.start && query.end <= cachedSlices.end);
  }

  mockFetchDataFromBackend(query: TraceDataQuery) {
    if (query.process == null || query.thread == null) return;
    let threadDataMap = 
        this.processDataMap.get(query.process);
    if (threadDataMap == null) {
      threadDataMap = new Map();
      this.processDataMap.set(query.process, threadDataMap);
    }

    let slices = [];
        const tracksData = Object.values(this.state().tracksData);
    if (tracksData.length > 0) {
      slices = tracksData[0]!.data;
    } else {
      const sliceStartBegin = Math.floor(query.start/50) * 50;
      const sliceStartEnd = query.end;
      for (let t = sliceStartBegin; t < sliceStartEnd; t+= 100) {
        slices.push({
          start: t,
          end: t + 50,
          title: 'SliceName',
          tid: query.thread,
          pid: query.process,
        });
      }
    }

    threadDataMap.set(query.thread, {
      start: query.start,
      end: query.end,
      slices,
    });
  }
}


// Singleton.
export const traceDataStore = new TraceDataStore();

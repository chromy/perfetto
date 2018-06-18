import { TrackSlice } from './backend/state';
import {Nanoseconds} from './time-scale';

let gUiMockSliceId = 0;

interface TrackSliceCache {
  // Start and end time of data that we have cached.
  start: Nanoseconds;
  end: Nanoseconds;

  slices: TrackSlice[];
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

type ThreadDataMap = Map<number, TrackSliceCache>;
type ProcessDataMap = Map<number, ThreadDataMap>;

function getFirstIndexWhereTrue(slices: TrackSlice[],
    testFn: (slice: TrackSlice) => Boolean) : number {
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
  private terribleSliceCache: Map<string, TrackSlice> = new Map();

  constructor() {}

  initialize( rerenderCallback: () => any) {
    this.onNewDataReceived = rerenderCallback;
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

    const sliceStartBegin = Math.floor(query.start/100) * 100;
    const sliceStartEnd = query.end;
    const slices : TrackSlice[] = [];
    for (let t = sliceStartBegin; t < sliceStartEnd; t+= 100) {
      const cacheKey = '' + t + '-' + query.thread + '-' + query.process;
      let slice = this.terribleSliceCache.get(cacheKey);
      if (slice == null) {
        slice = {
          id: 'mock-' + (gUiMockSliceId++),
          start: t,
          end: t + 50,
          title: 'SliceName',
        };
        this.terribleSliceCache.set(cacheKey, slice);
      }
      slices.push(slice);
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

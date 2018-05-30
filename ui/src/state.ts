export interface State {
  loadedTraces: string[]; // Handles to traces
  gps: {
    startVisibleWindow: number,
    endVisibleWindow: number
  };
  trackTree: TrackTreeState;
  sliceTrackDataSpec: {
    // Minimal data you need to obtain the complete slice data
    //Rendering Class (maybe - or maybe it's automatically inferred from the TrackDataSpec class?
    //start, end of drawing range,
    //process, thread
    // Does not contain a list of all the slices.
  }
}


export interface TrackTreeState {
  metadata: {
    name: string,
    shellColor: string
  };
  children: (TrackTreeState|TrackState)[];
}



export interface TrackState {
  metadata: {};
  trackData: TrackDataSpec;
}

type TrackDataSpec = CpuTrackDataSpec | SliceTrackDataSpec;

interface CpuTrackDataSpec {

}

interface SliceTrackDataSpec {

}

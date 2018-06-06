/*
class TrackContentData = union {
  SliceTrackContentData,
      CpuTrackContentData,
...
}
*/

import {SliceTrackContentData} from './slice-track-content-data';

export type TrackContentData = SliceTrackContentData | CpuTrackContentData;

/*
abstract class TrackContentData {

}
*/

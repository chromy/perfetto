/*
class TrackContentData = union {
  SliceTrackContentData,
      CpuTrackContentData,
...
}
*/

type TrackContentData = SliceTrackContentData | CpuTrackContentData;

/*
abstract class TrackContentData {

}
*/

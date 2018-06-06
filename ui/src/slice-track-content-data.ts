export interface SliceTrackContentData {
  trace: string;
  thread: string;
  process: string;
  slices: {start: number, end: number }[];
}

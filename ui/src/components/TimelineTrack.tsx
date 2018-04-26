// src/components/Hello.tsx

import * as React from 'react';
import './TimelineTrack.css';

export interface TimelineProps {
    x: number;  // x-coordinate of the beginning of the timeline.
    zoom: number;
};


function TimelineTrack(props: TimelineProps) {
  return (
    <div className="timeline-track">
          X Coordinate is {props.x}. Zoon level is {props.zoom}.
    </div>
  );
}

export default TimelineTrack;

// helpers
// no helpers so far.

// src/types/index.tsx

export interface TimelineState {
    x: number,
    zoom: number;
}

// TODO: Get rid of the capital I.
export interface IStoreState {
    languageName: string;
    enthusiasmLevel: number;
    timeline: TimelineState;
}

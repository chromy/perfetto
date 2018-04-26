// src/reducers/index.tsx

import { Action } from '../actions';
import { ActionName } from '../constants/index';
import { IStoreState } from '../types/index';

export function enthusiasm(state: IStoreState, action: Action): IStoreState {
    // tslint:disable-next-line
    console.log(action);
    switch (action.type) {
        case ActionName.INCREMENT_ENTHUSIASM:
            return { ...state, enthusiasmLevel: state.enthusiasmLevel + 1 };
        case ActionName.DECREMENT_ENTHUSIASM:
            return { ...state, enthusiasmLevel: Math.max(1, state.enthusiasmLevel - 1) };
        case ActionName.SHIFT_TIMELINE_RIGHT:
            // TODO: There are definitely less verbose conventions of doing
            // this, but keeping things explicit for now.
            return { ...state,
                     timeline: {
                         ...state.timeline,
                         x: state.timeline.x + state.timeline.zoom,
                     },
            };
        default:
            return state;
    }
}

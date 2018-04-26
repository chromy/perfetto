import { ActionName } from '../constants'

export interface Action {
    type: ActionName;
}

export function incrementEnthusiasm(): Action {
    return {
        type: ActionName.INCREMENT_ENTHUSIASM,
    }
}

export function decrementEnthusiasm(): Action {
    return {
        type: ActionName.DECREMENT_ENTHUSIASM,
    }
}

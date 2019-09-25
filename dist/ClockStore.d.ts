import { DocId } from './Misc';
import SQLStore from './SQLStore';
import { Clock } from './Clock';
import Queue from './Queue';
export interface ClockMap {
    [documentId: string]: Clock;
}
export declare type ClockUpdate = [DocId, Clock];
export default class ClockStore {
    updateLog: Queue<ClockUpdate>;
    private store;
    constructor(store: SQLStore);
    get(documentId: DocId): Promise<Clock | undefined>;
    getMultiple(documentIds: DocId[]): Promise<ClockMap>;
    set(documentId: DocId, clock: Clock): Promise<ClockUpdate>;
    merge(documentId: DocId, clock: Clock): Promise<ClockUpdate>;
}

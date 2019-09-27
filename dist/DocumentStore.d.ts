import { DocId } from './Misc';
import * as Automerge from 'automerge';
import ClockStore, { Clock } from './ClockStore';
import FeedStore from './FeedStore';
interface Document {
    id: DocId;
    clock: Clock;
    minimumClock?: Clock;
}
export default class DocumentStore {
    feeds: FeedStore;
    clocks: ClockStore;
    docs: Map<DocId, Document>;
    constructor(feeds: FeedStore, clocks: ClockStore);
    create(): Promise<DocId>;
    open(docId: DocId): void;
    write(docId: DocId, changes: Automerge.Change[]): void;
}
export {};

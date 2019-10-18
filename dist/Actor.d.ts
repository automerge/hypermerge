import { Change } from 'automerge';
import { ActorId, DiscoveryId } from './Misc';
import * as Keys from './Keys';
import FeedStore, { Feed } from './FeedStore';
export declare type ActorMsg = ActorFeedReady | ActorInitialized | ActorSync | Download;
interface ActorSync {
    type: 'ActorSync';
    actor: Actor;
}
interface ActorFeedReady {
    type: 'ActorFeedReady';
    actor: Actor;
    feed: Feed;
    writable: boolean;
}
interface ActorInitialized {
    type: 'ActorInitialized';
    actor: Actor;
}
interface Download {
    type: 'Download';
    actor: Actor;
    time: number;
    size: number;
    index: number;
}
interface ActorConfig {
    keys: Keys.KeyBuffer;
    notify: (msg: ActorMsg) => void;
    store: FeedStore;
}
export declare class Actor {
    id: ActorId;
    dkString: DiscoveryId;
    changes: Change[];
    private q;
    private notify;
    private store;
    constructor(config: ActorConfig);
    onReady: (cb: (actor: Actor) => void) => void;
    writeChange(change: Change): void;
    close(): Promise<Keys.PublicId>;
    private getOrCreateFeed;
    private onFeedReady;
    private onDownload;
    private onSync;
    private onClose;
    private parseBlock;
}
export {};

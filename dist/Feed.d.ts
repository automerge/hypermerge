import { RepoBackend, KeyBuffer, FeedFn } from "./RepoBackend";
import { Feed } from "./hypercore";
import { Change } from "automerge/backend";
import Queue from "./Queue";
export declare class FeedMgr {
    id: string;
    back: RepoBackend;
    q: Queue<FeedFn>;
    changes: Change[];
    feed: Feed<Uint8Array>;
    constructor(back: RepoBackend, keys: KeyBuffer);
    push(cb: FeedFn): void;
    writeChange(change: Change): void;
}

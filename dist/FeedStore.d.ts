/// <reference types="better-sqlite3" />
/// <reference types="node" />
import { Readable, Writable } from 'stream';
import { Feed } from 'hypercore';
import { KeyPair, PublicId, DiscoveryId } from './Keys';
import Queue from './Queue';
import { Database } from './SqlDatabase';
export declare type Feed = Feed<Block>;
export declare type FeedId = PublicId;
export declare type Block = Uint8Array;
interface StorageFn {
    (path: string): (filename: string) => unknown;
}
/**
 * Note:
 * FeedId should really be the discovery key. The public key should be
 * PublicId. Reading and writing to existing hypercores does not require the
 * public key; it's saved to disk. In a future refactor, we plan to remove the
 * reliance on public keys, and instead only provide the public key when
 * creating a new hypercore, or opening an unknown hypercore. The ledger keeps
 * track of which hypercores have already been opened.
 */
export default class FeedStore {
    private storage;
    private loaded;
    info: FeedInfoStore;
    constructor(db: Database, storageFn: StorageFn);
    /**
     * Create a brand-new writable feed using the given key pair.
     * Promises the FeedId.
     */
    create(keys: Required<KeyPair>): Promise<FeedId>;
    append(feedId: FeedId, ...blocks: Block[]): Promise<number>;
    appendStream(feedId: FeedId): Promise<Writable>;
    read(feedId: FeedId, seq: number): Promise<Block>;
    head(feedId: FeedId): Promise<Block>;
    stream(feedId: FeedId, start?: number, end?: number): Promise<Readable>;
    closeFeed(feedId: FeedId): Promise<FeedId>;
    close(): Promise<void>;
    getFeed(feedId: FeedId): Promise<Feed<Block>>;
    private open;
    private openOrCreateFeed;
}
export interface FeedInfo {
    publicId: PublicId;
    discoveryId: DiscoveryId;
    isWritable: 0 | 1;
}
export declare class FeedInfoStore {
    createdQ: Queue<FeedInfo>;
    private prepared;
    constructor(db: Database);
    save(info: FeedInfo): void;
    getPublicId(discoveryId: DiscoveryId): PublicId | undefined;
    hasDiscoveryId(discoveryId: DiscoveryId): boolean;
    byPublicId(publicId: PublicId): FeedInfo | undefined;
    byDiscoveryId(discoveryId: DiscoveryId): FeedInfo | undefined;
    allPublicIds(): PublicId[];
    allDiscoveryIds(): DiscoveryId[];
}
export {};

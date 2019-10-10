/// <reference types="node" />
import Queue from './Queue';
import { Metadata } from './Metadata';
import { Actor } from './Actor';
import { Clock } from './Clock';
import { ToBackendQueryMsg, ToBackendRepoMsg, ToFrontendRepoMsg } from './RepoMsg';
import { Change } from 'automerge';
import * as DocBackend from './DocBackend';
import { ActorId, DiscoveryId, DocId, RepoId } from './Misc';
import FeedStore from './FeedStore';
import FileStore from './FileStore';
import { Swarm } from './Network';
import ClockStore from './ClockStore';
import KeyStore from './KeyStore';
export interface FeedData {
    actorId: ActorId;
    writable: Boolean;
    changes: Change[];
}
export interface Options {
    path?: string;
    memory?: boolean;
}
export declare class RepoBackend {
    path?: string;
    storage: Function;
    keys: KeyStore;
    store: FeedStore;
    files: FileStore;
    clocks: ClockStore;
    actors: Map<ActorId, Actor>;
    actorsDk: Map<DiscoveryId, Actor>;
    docs: Map<DocId, DocBackend.DocBackend>;
    meta: Metadata;
    opts: Options;
    toFrontend: Queue<ToFrontendRepoMsg>;
    id: RepoId;
    swarmKey: Buffer;
    private db;
    private fileServer;
    private network;
    constructor(opts: Options);
    startFileServer: (path: string) => void;
    private create;
    private debug;
    private destroy;
    private open;
    merge(id: DocId, clock: Clock): void;
    close: () => Promise<[void, void]>;
    private allReadyActors;
    private loadDocument;
    join: (actorId: ActorId) => void;
    leave: (actorId: ActorId) => void;
    private getReadyActor;
    storageFn: (path: string) => (name: string) => any;
    initActorFeed(doc: DocBackend.DocBackend): ActorId;
    actorIds(doc: DocBackend.DocBackend): ActorId[];
    docActors(doc: DocBackend.DocBackend): Actor[];
    syncReadyActors: (ids: ActorId[]) => void;
    private documentNotify;
    private broadcastNotify;
    private actorNotify;
    private initActor;
    syncChanges: (actor: Actor) => void;
    setSwarm: (swarm: Swarm) => void;
    stream: (opts: any) => any;
    subscribe: (subscriber: (message: ToFrontendRepoMsg) => void) => void;
    handleQuery: (id: number, query: ToBackendQueryMsg) => void;
    receive: (msg: ToBackendRepoMsg) => void;
    actor(id: ActorId): Actor | undefined;
}

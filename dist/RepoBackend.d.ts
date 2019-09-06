/// <reference types="node" />
import Queue from './Queue';
import { Metadata } from './Metadata';
import { Actor } from './Actor';
import { Clock, Change } from 'automerge/backend';
import { ToBackendQueryMsg, ToBackendRepoMsg, ToFrontendRepoMsg } from './RepoMsg';
import * as DocBackend from './DocBackend';
import { ActorId, DiscoveryId, DocId } from './Misc';
import FeedStore from './FeedStore';
import FileStore from './FileStore';
import { Swarm } from './Network';
export interface FeedData {
    actorId: ActorId;
    writable: Boolean;
    changes: Change[];
}
export interface Options {
    path?: string;
    storage: Function;
}
export declare class RepoBackend {
    path?: string;
    storage: Function;
    store: FeedStore;
    files: FileStore;
    actors: Map<ActorId, Actor>;
    actorsDk: Map<DiscoveryId, Actor>;
    docs: Map<DocId, DocBackend.DocBackend>;
    meta: Metadata;
    opts: Options;
    toFrontend: Queue<ToFrontendRepoMsg>;
    id: Buffer;
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
    allClocks(actorId: ActorId): {
        [docId: string]: Clock;
    };
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

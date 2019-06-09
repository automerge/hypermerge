import Queue from "./Queue";
import { Metadata } from "./Metadata";
import { Actor } from "./Actor";
import { Clock, Change } from "automerge";
import { ToBackendQueryMsg, ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg";
import { DocBackend } from "./DocBackend";
interface Swarm {
    join(dk: Buffer): void;
    leave(dk: Buffer): void;
    on: Function;
}
export interface FeedData<T> {
    actorId: string;
    writable: Boolean;
    changes: Change<T>[];
}
export interface Options {
    path?: string;
    storage: Function;
}
export declare class RepoBackend<T> {
    path?: string;
    storage: Function;
    joined: Set<string>;
    actors: Map<string, Actor<T>>;
    actorsDk: Map<string, Actor<T>>;
    docs: Map<string, DocBackend<T>>;
    meta: Metadata;
    opts: Options;
    toFrontend: Queue<ToFrontendRepoMsg>;
    swarm?: Swarm;
    id: Buffer;
    file?: Uint8Array;
    constructor(opts: Options);
    private writeFile;
    private readFile;
    private create;
    private debug;
    private destroy;
    private open;
    merge(id: string, clock: Clock): void;
    close: () => void;
    replicate: (swarm: Swarm) => void;
    private allReadyActors;
    private loadDocument;
    join: (actorId: string) => void;
    leave: (actorId: string) => void;
    private getReadyActor;
    storageFn: (path: string) => Function;
    initActorFeed(doc: DocBackend<T>): string;
    actorIds(doc: DocBackend<T>): string[];
    docActors(doc: DocBackend<T>): Actor<T>[];
    syncReadyActors: (ids: string[]) => void;
    allClocks(actorId: string): {
        [id: string]: Clock;
    };
    private documentNotify;
    private broadcastNotify;
    private actorNotify;
    private initActor;
    syncChanges: (actor: Actor<T>) => void;
    stream: (opts: any) => any;
    subscribe: (subscriber: (message: ToFrontendRepoMsg) => void) => void;
    handleQuery: (id: number, query: ToBackendQueryMsg) => void;
    receive: (msg: ToBackendRepoMsg<T>) => void;
    actor(id: string): Actor<T> | undefined;
}
export {};

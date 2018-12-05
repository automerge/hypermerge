/// <reference types="node" />
import Queue from "./Queue";
import { Metadata } from "./Metadata";
import { Actor } from "./Actor";
import { Clock, Change } from "automerge/backend";
import { ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg";
import { DocBackend } from "./DocBackend";
interface Swarm {
    join(dk: Buffer): void;
    leave(dk: Buffer): void;
    on: Function;
}
export interface KeyBuffer {
    publicKey: Buffer;
    secretKey?: Buffer;
}
export interface FeedData {
    actorId: string;
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
    joined: Set<Buffer>;
    actors: Map<string, Actor>;
    actorsDk: Map<string, Actor>;
    docs: Map<string, DocBackend>;
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
    private open;
    merge(id: string, clock: Clock): void;
    follow(id: string, target: string): void;
    replicate: (swarm: Swarm) => void;
    private allReadyActors;
    private loadDocument;
    join: (actorId: string) => void;
    private leave;
    private getReadyActor;
    storageFn: (path: string) => Function;
    initActorFeed(doc: DocBackend): string;
    actorIds(doc: DocBackend): string[];
    docActors(doc: DocBackend): Actor[];
    syncReadyActors: (ids: string[]) => void;
    private actorNotify;
    private initActor;
    syncChanges: (actor: Actor) => void;
    stream: (opts: any) => any;
    releaseManager(doc: DocBackend): void;
    subscribe: (subscriber: (message: ToFrontendRepoMsg) => void) => void;
    receive: (msg: ToBackendRepoMsg) => void;
    actor(id: string): Actor | undefined;
}
export {};

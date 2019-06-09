import { Options, RepoBackend } from "./RepoBackend";
import { RepoFrontend } from "./RepoFrontend";
import { Handle } from "./Handle";
import { PublicMetadata } from "./Metadata";
import { Clock } from "./Clock";
interface Swarm {
    join(dk: Buffer): void;
    leave(dk: Buffer): void;
    on: Function;
}
export declare class Repo<T> {
    front: RepoFrontend<T>;
    back: RepoBackend<T>;
    id: Buffer;
    stream: (opts: any) => any;
    create: (init?: T) => string;
    open: (id: string) => Handle<T>;
    destroy: (id: string) => void;
    replicate: (swarm: Swarm) => void;
    fork: (id: string) => string;
    watch: (id: string, cb: (val: T, clock?: Clock, index?: number) => void) => Handle<T>;
    doc: (id: string, cb?: (val: T, clock?: Clock) => void) => Promise<T>;
    merge: (id: string, target: string) => void;
    change: (id: string, fn: (state: T) => void) => void;
    writeFile: (data: Uint8Array, mimeType: string) => string;
    readFile: (id: string, cb: (data: Uint8Array, mimeType: string) => void) => void;
    materialize: (id: string, seq: number, cb: (val: T) => void) => void;
    meta: (id: string, cb: (meta: PublicMetadata | undefined) => void) => void;
    close: () => void;
    constructor(opts: Options);
}
export {};

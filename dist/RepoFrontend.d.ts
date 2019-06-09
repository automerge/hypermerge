import Queue from "./Queue";
import MapSet from "./MapSet";
import { ToBackendQueryMsg, ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg";
import { Handle } from "./Handle";
import { Patch } from "automerge";
import { DocFrontend } from "./DocFrontend";
import { Clock } from "./Clock";
export interface DocMetadata {
    clock: Clock;
    history: number;
    actor?: string;
}
export interface ProgressEvent {
    actor: string;
    index: number;
    size: number;
    time: number;
}
export declare class RepoFrontend<T> {
    toBackend: Queue<ToBackendRepoMsg<T>>;
    docs: Map<string, DocFrontend<any>>;
    cb: Map<number, (reply: any) => void>;
    msgcb: Map<number, (patch: Patch) => void>;
    readFiles: MapSet<string, (data: Uint8Array, mimeType: string) => void>;
    file?: Uint8Array;
    create: (init?: T | undefined) => string;
    change: (id: string, fn: (state: T) => void) => void;
    meta: (url: string, cb: (meta: import("./Metadata").PublicDocMetadata | import("./Metadata").PublicFileMetadata | undefined) => void) => void;
    meta2: (url: string) => DocMetadata | undefined;
    merge: (url: string, target: string) => void;
    writeFile: (data: Uint8Array, mimeType: string) => string;
    readFile: (url: string, cb: (data: Uint8Array, mimeType: string) => void) => void;
    fork: (url: string) => string;
    watch: (url: string, cb: (val: T, clock?: Clock | undefined, index?: number | undefined) => void) => Handle<T>;
    doc: (url: string, cb?: ((val: T, clock?: Clock | undefined) => void) | undefined) => Promise<T>;
    materialize: (url: string, history: number, cb: (val: T) => void) => void;
    queryBackend(query: ToBackendQueryMsg, cb: (arg: any) => void): void;
    open: (url: string) => Handle<T>;
    debug(url: string): void;
    private openDocFrontend;
    subscribe: (subscriber: (message: ToBackendRepoMsg<T>) => void) => void;
    close: () => void;
    destroy: (url: string) => void;
    receive: (msg: ToFrontendRepoMsg) => void;
}

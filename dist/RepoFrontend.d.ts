import Queue from "./Queue";
import MapSet from "./MapSet";
import { ToBackendQueryMsg, ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg";
import { Handle } from "./Handle";
import { ChangeFn, Patch } from "automerge/frontend";
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
export declare class RepoFrontend {
    toBackend: Queue<ToBackendRepoMsg>;
    docs: Map<string, DocFrontend<any>>;
    cb: Map<number, (reply: any) => void>;
    msgcb: Map<number, (patch: Patch) => void>;
    readFiles: MapSet<string, (data: Uint8Array, mimeType: string) => void>;
    file?: Uint8Array;
    create: (init?: any) => string;
    change: <T>(id: string, fn: ChangeFn<T>) => void;
    meta: (url: string, cb: (meta: import("./Metadata").PublicDocMetadata | import("./Metadata").PublicFileMetadata | undefined) => void) => void;
    meta2: (url: string) => DocMetadata | undefined;
    merge: (url: string, target: string) => void;
    writeFile: <T>(data: Uint8Array, mimeType: string) => string;
    readFile: <T>(url: string, cb: (data: Uint8Array, mimeType: string) => void) => void;
    fork: (url: string) => string;
    follow: (url: string, target: string) => void;
    watch: <T>(url: string, cb: (val: T, clock?: Clock | undefined, index?: number | undefined) => void) => Handle<T>;
    doc: <T>(url: string, cb?: ((val: T, clock?: Clock | undefined) => void) | undefined) => Promise<T>;
    materialize: <T>(url: string, history: number, cb: (val: T) => void) => void;
    queryBackend(query: ToBackendQueryMsg, cb: (arg: any) => void): void;
    open: <T>(url: string) => Handle<T>;
    debug(url: string): void;
    private openDocFrontend;
    subscribe: (subscriber: (message: ToBackendRepoMsg) => void) => void;
    destroy: (url: string) => void;
    receive: (msg: ToFrontendRepoMsg) => void;
}

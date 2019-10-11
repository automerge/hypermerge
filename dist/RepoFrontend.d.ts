import Queue from './Queue';
import MapSet from './MapSet';
import { ToBackendQueryMsg, ToBackendRepoMsg, ToFrontendRepoMsg } from './RepoMsg';
import { Handle } from './Handle';
import { Patch, ChangeFn } from 'automerge';
import { DocFrontend } from './DocFrontend';
import { Clock } from './Clock';
import { DocUrl, DocId, ActorId, HyperfileId, HyperfileUrl } from './Misc';
import FileServerClient from './FileServerClient';
export interface DocMetadata {
    clock: Clock;
    history: number;
    actor?: ActorId;
}
export interface ProgressEvent {
    actor: ActorId;
    index: number;
    size: number;
    time: number;
}
export declare class RepoFrontend {
    toBackend: Queue<ToBackendRepoMsg>;
    docs: Map<DocId, DocFrontend<any>>;
    cb: Map<number, (reply: any) => void>;
    msgcb: Map<number, (patch: Patch) => void>;
    readFiles: MapSet<HyperfileId, (data: Uint8Array, mimeType: string) => void>;
    files: FileServerClient;
    create: <T>(init?: T | undefined) => DocUrl;
    change: <T>(url: DocUrl, fn: ChangeFn<T>) => void;
    meta: (url: DocUrl | HyperfileUrl, cb: (meta: import("./Metadata").PublicDocMetadata | import("./Metadata").PublicFileMetadata | undefined) => void) => void;
    meta2: (url: DocUrl | HyperfileUrl) => DocMetadata | undefined;
    merge: (url: DocUrl, target: DocUrl) => void;
    fork: (url: DocUrl) => DocUrl;
    watch: <T>(url: DocUrl, cb: (val: import("automerge").FreezeObject<T>, clock?: Clock | undefined, index?: number | undefined) => void) => Handle<T>;
    message: <T>(url: DocUrl, contents: T) => void;
    doc: <T>(url: DocUrl, cb?: ((val: import("automerge").FreezeObject<T>, clock?: Clock | undefined) => void) | undefined) => Promise<import("automerge").FreezeObject<T>>;
    materialize: <T>(url: DocUrl, history: number, cb: (val: import("automerge").FreezeObject<T>) => void) => void;
    queryBackend(query: ToBackendQueryMsg, cb: (arg: any) => void): void;
    open: <T>(url: DocUrl) => Handle<T>;
    debug(url: DocUrl): void;
    private openDocFrontend;
    subscribe: (subscriber: (message: ToBackendRepoMsg) => void) => void;
    close: () => void;
    destroy: (url: DocUrl) => void;
    receive: (msg: ToFrontendRepoMsg) => void;
}

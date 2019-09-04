/// <reference types="node" />
import { Options, RepoBackend } from './RepoBackend';
import { RepoFrontend } from './RepoFrontend';
import { Handle } from './Handle';
import { PublicMetadata } from './Metadata';
import { Clock } from './Clock';
import { DocUrl, HyperfileUrl } from './Misc';
interface Swarm {
    join(dk: Buffer): void;
    leave(dk: Buffer): void;
    on: Function;
}
export declare class Repo {
    front: RepoFrontend;
    back: RepoBackend;
    id: Buffer;
    stream: (opts: any) => any;
    create: <T>(init?: T) => DocUrl;
    open: <T>(id: DocUrl) => Handle<T>;
    destroy: (id: DocUrl) => void;
    replicate: (swarm: Swarm) => void;
    message: (url: DocUrl, message: any) => void;
    fork: (url: DocUrl) => DocUrl;
    watch: <T>(url: DocUrl, cb: (val: T, clock?: Clock, index?: number) => void) => Handle<T>;
    doc: <T>(url: DocUrl, cb?: (val: T, clock?: Clock) => void) => Promise<T>;
    merge: (url: DocUrl, target: DocUrl) => void;
    change: <T>(url: DocUrl, fn: (state: T) => void) => void;
    writeFile: (data: Uint8Array, mimeType: string) => HyperfileUrl;
    readFile: (url: HyperfileUrl, cb: (data: Uint8Array, mimeType: string) => void) => void;
    materialize: <T>(url: DocUrl, seq: number, cb: (val: T) => void) => void;
    meta: (url: DocUrl | HyperfileUrl, cb: (meta: PublicMetadata | undefined) => void) => void;
    close: () => void;
    constructor(opts: Options);
}
export {};

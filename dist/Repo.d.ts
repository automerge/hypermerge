/// <reference types="node" />
import { Options, RepoBackend } from './RepoBackend';
import { RepoFrontend } from './RepoFrontend';
import { Handle } from './Handle';
import { PublicMetadata } from './Metadata';
import { Clock } from './Clock';
import { DocUrl, HyperfileUrl } from './Misc';
import FileServerClient from './FileServerClient';
import { Swarm } from './Network';
interface RepoOptions extends Options {
    serverPath: string;
}
export declare class Repo {
    front: RepoFrontend;
    back: RepoBackend;
    id: Buffer;
    stream: (opts: any) => any;
    create: <T>(init?: T) => DocUrl;
    open: <T>(id: DocUrl) => Handle<T>;
    destroy: (id: DocUrl) => void;
    setSwarm: (swarm: Swarm) => void;
    message: (url: DocUrl, message: any) => void;
    fork: (url: DocUrl) => DocUrl;
    watch: <T>(url: DocUrl, cb: (val: T, clock?: Clock, index?: number) => void) => Handle<T>;
    doc: <T>(url: DocUrl, cb?: (val: T, clock?: Clock) => void) => Promise<T>;
    merge: (url: DocUrl, target: DocUrl) => void;
    change: <T>(url: DocUrl, fn: (state: T) => void) => void;
    files: FileServerClient;
    materialize: <T>(url: DocUrl, seq: number, cb: (val: T) => void) => void;
    meta: (url: DocUrl | HyperfileUrl, cb: (meta: PublicMetadata | undefined) => void) => void;
    close: () => void;
    constructor(opts: RepoOptions);
}
export {};

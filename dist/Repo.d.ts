/// <reference types="node" />
import { Options, RepoBackend } from './RepoBackend';
import { RepoFrontend } from './RepoFrontend';
import { Handle } from './Handle';
import { PublicMetadata } from './Metadata';
import { Clock } from './Clock';
import { DocUrl, HyperfileUrl, RepoId } from './Misc';
import FileServerClient from './FileServerClient';
import { Swarm } from './Network';
import { Doc, Proxy } from 'automerge';
export declare class Repo {
    front: RepoFrontend;
    back: RepoBackend;
    id: RepoId;
    swarmKey: Buffer;
    stream: (opts: any) => any;
    create: <T>(init?: T) => DocUrl;
    open: <T>(id: DocUrl) => Handle<T>;
    destroy: (id: DocUrl) => void;
    setSwarm: (swarm: Swarm) => void;
    message: (url: DocUrl, message: any) => void;
    files: FileServerClient;
    startFileServer: (fileServerPath: string) => void;
    fork: (url: DocUrl) => DocUrl;
    watch: <T>(url: DocUrl, cb: (val: Doc<T>, clock?: Clock, index?: number) => void) => Handle<T>;
    doc: <T>(url: DocUrl, cb?: (val: Doc<T>, clock?: Clock) => void) => Promise<Doc<T>>;
    merge: (url: DocUrl, target: DocUrl) => void;
    change: <T>(url: DocUrl, fn: (state: Proxy<T>) => void) => void;
    materialize: <T>(url: DocUrl, seq: number, cb: (val: Doc<T>) => void) => void;
    meta: (url: DocUrl | HyperfileUrl, cb: (meta: PublicMetadata | undefined) => void) => void;
    close: () => void;
    constructor(opts: Options);
}

import { Options, RepoBackend } from './RepoBackend';
import { RepoFrontend } from './RepoFrontend';
import { Handle } from './Handle';
import { PublicMetadata } from './Metadata';
import { Clock } from './Clock';
import { DocUrl, HyperfileUrl, RepoId } from './Misc';
import FileServerClient from './FileServerClient';
import { Swarm, JoinOptions } from './SwarmInterface';
import { Doc, Proxy } from 'cambriamerge';
import { CryptoClient } from './CryptoClient';
export declare class Repo {
    front: RepoFrontend;
    back: RepoBackend;
    id: RepoId;
    create: <T>(schema: string, init?: T) => DocUrl;
    open: <T>(id: DocUrl, schema: string) => Handle<T>;
    destroy: (id: DocUrl) => void;
    /** @deprecated Use addSwarm */
    setSwarm: (swarm: Swarm, joinOptions?: JoinOptions) => void;
    addSwarm: (swarm: Swarm, joinOptions?: JoinOptions) => void;
    removeSwarm: (swarm: Swarm, joinOptions?: JoinOptions) => void;
    message: (url: DocUrl, message: any) => void;
    crypto: CryptoClient;
    files: FileServerClient;
    startFileServer: (fileServerPath: string) => void;
    fork: (url: DocUrl, schema: string) => DocUrl;
    watch: <T>(url: DocUrl, schema: string, cb: (val: Doc<T>, clock?: Clock, index?: number) => void) => Handle<T>;
    doc: <T>(url: DocUrl, schema: string, cb?: (val: Doc<T>, clock?: Clock) => void) => Promise<Doc<T>>;
    merge: (url: DocUrl, target: DocUrl, schema: string) => void;
    change: <T>(url: DocUrl, schema: string, fn: (state: Proxy<T>) => void) => void;
    materialize: <T>(url: DocUrl, seq: number, cb: (val: Doc<T>) => void) => void;
    meta: (url: DocUrl | HyperfileUrl, cb: (meta: PublicMetadata | undefined) => void) => void;
    close: () => void;
    constructor(opts: Options);
}

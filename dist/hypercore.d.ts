/// <reference types="node" />
import { ActorId } from './Misc';
import { Readable, Writable } from 'stream';
declare type Key = string | Buffer;
declare type Storage = string | Function;
export interface Options {
    secretKey?: Key;
    valueEncoding?: string;
    extensions?: string[];
}
export interface ReadOpts {
    wait?: boolean;
    timeout?: number;
    valueEncoding?: string;
}
export declare function discoveryKey(buf: Buffer): Buffer;
export declare function hypercore<T>(storage: Storage, options: Options): Feed<T>;
export declare function hypercore<T>(storage: Storage, key: Key, options: Options): Feed<T>;
export interface Peer {
    feed: any;
    stream: any;
    onextension: any;
    remoteId: Buffer;
    extension: any;
    extensions: string[];
}
export interface FeedEvents<T> {
    ready(): void;
    close(): void;
    sync(): void;
    error(err: Error): void;
    download(index: number, data: Buffer): void;
    upload(index: number, data: T): void;
    data(idx: number, data: T): void;
    extension(name: string, msg: Buffer, peer: Peer): void;
    ['peer-add'](peer: Peer): void;
    ['peer-remove'](peer: Peer): void;
}
export interface Feed<T> {
    peers: Peer[];
    replicate: Function;
    writable: boolean;
    discoveryKey: Buffer;
    key: Buffer;
    length: number;
    ready: Function;
    readonly extensions: string[];
    on<K extends keyof FeedEvents<T>>(event: K, cb: FeedEvents<T>[K]): this;
    off<K extends keyof FeedEvents<T>>(event: K, cb: FeedEvents<T>[K]): this;
    append(data: T): void;
    append(data: T, cb: (err: Error | null, seq: number) => void): void;
    clear(index: number, cb: () => void): void;
    clear(start: number, end: number, cb: () => void): void;
    downloaded(): number;
    downloaded(start: number): number;
    downloaded(start: number, end: number): number;
    has(index: number): boolean;
    has(start: number, end: number): boolean;
    signature(cb: (err: any, sig: any) => void): void;
    signature(index: number, cb: (err: any, sig: any) => void): void;
    verify(index: number, sig: Buffer, cb: (err: any, roots: any) => void): void;
    close(cb: (err: Error) => void): void;
    get(index: number, cb: (err: Error, data: T) => void): void;
    get(index: number, config: any, cb: (err: Error, data: T) => void): void;
    getBatch(start: number, end: number, cb: (Err: any, data: T[]) => void): void;
    getBatch(start: number, end: number, config: any, cb: (Err: any, data: T[]) => void): void;
    createReadStream(opts: any): Readable;
    createWriteStream(): Writable;
    extension(name: string, msg: Buffer): void;
}
export declare function readFeed<T>(id: ActorId | 'ledger', feed: Feed<T>, cb: (data: T[]) => void): void;
export {};

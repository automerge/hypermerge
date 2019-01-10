/// <reference types="node" />
declare type Key = string | Buffer;
declare type Storage = string | Function;
export interface Options {
    secretKey?: Key;
    valueEncoding?: string;
}
export interface ReadOpts {
    wait?: boolean;
    timeout?: number;
    valueEncoding?: string;
}
export declare function discoveryKey(buf: Buffer): Buffer;
export declare function hypercore<T>(storage: Storage, options: Options): Feed<T>;
export declare function hypercore<T>(storage: Storage, key: Key, options: Options): Feed<T>;
export interface Feed<T> {
    on(event: "ready", cb: () => void): this;
    on(event: "close", cb: () => void): this;
    on(event: "sync", cb: () => void): this;
    on(event: "error", cb: (err: Error) => void): this;
    on(event: "download", cb: (index: number, data: Buffer) => void): this;
    on(event: "upload", cb: (index: number, data: T) => void): this;
    on(event: "data", cb: (idx: number, data: T) => void): this;
    on(event: "peer-add", cb: (peer: Peer) => void): this;
    on(event: "peer-remove", cb: (peer: Peer) => void): this;
    on(event: "extension", cb: (a: any, b: any) => void): this;
    peers: Peer[];
    replicate: Function;
    writable: boolean;
    ready: Function;
    append(data: T): void;
    append(data: T, cb: (err: Error | null) => void): void;
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
    close(): void;
    get(index: number, cb: (err: Error, data: T) => void): void;
    get(index: number, config: any, cb: (err: Error, data: T) => void): void;
    getBatch(start: number, end: number, cb: (Err: any, data: T[]) => void): void;
    getBatch(start: number, end: number, config: any, cb: (Err: any, data: T[]) => void): void;
    discoveryKey: Buffer;
    id: Buffer;
    length: number;
}
export declare function readFeed<T>(feed: Feed<T>, cb: (data: T[]) => void): void;
export interface Peer {
    feed: any;
    stream: any;
    onextension: any;
}
export {};

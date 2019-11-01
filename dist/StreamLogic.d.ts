/// <reference types="node" />
import { Transform, TransformCallback, Readable } from 'stream';
import { Hash } from 'crypto';
export declare class ChunkSizeTransform extends Transform {
    private pending;
    chunkSize: number;
    processedBytes: number;
    chunkCount: number;
    constructor(chunkSize: number);
    _transform(data: Buffer, _encoding: string, cb: TransformCallback): void;
    _flush(cb: () => void): void;
    private pushChunks;
    private readPendingChunks;
    private pendingLength;
}
export declare class HashPassThrough extends Transform {
    readonly hash: Hash;
    constructor(algorithm: string);
    _transform(data: Buffer, _encoding: string, cb: TransformCallback): void;
}
export declare class PrefixMatchPassThrough extends Transform {
    prefix: Buffer;
    matched: boolean;
    constructor(prefix: Buffer);
    _transform(chunk: Buffer, _encoding: string, cb: TransformCallback): void;
}
export declare class InvalidPrefixError extends Error {
    actual: Buffer;
    expected: Buffer;
    constructor(actual: Buffer, expected: Buffer);
}
export declare function toBuffer(stream: Readable): Promise<Buffer>;
export declare function fromBuffer(buffer: Buffer): Readable;
export declare function fromBuffers(buffers: Buffer[]): Readable;

/// <reference types="node" />
import { Transform, TransformCallback, Readable } from 'stream';
import { Hash } from 'crypto';
export declare class MaxChunkSizeTransform extends Transform {
    maxChunkSize: number;
    processedBytes: number;
    chunkCount: number;
    constructor(maxChunkSize: number);
    _transform(data: Buffer, _encoding: string, cb: TransformCallback): void;
}
export declare class HashPassThrough extends Transform {
    readonly hash: Hash;
    constructor(algorithm: string);
    _transform(data: Buffer, _encoding: string, cb: TransformCallback): void;
}
export declare function toBuffer(stream: Readable): Promise<Buffer>;
export declare function fromBuffer(buffer: Buffer): Readable;

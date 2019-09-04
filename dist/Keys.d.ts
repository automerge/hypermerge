/// <reference types="node" />
export interface KeyBuffer {
    publicKey: Buffer;
    secretKey?: Buffer;
}
export interface KeyPair {
    publicKey: string;
    secretKey: string;
}
export declare function create(): KeyPair;
export declare function decode(key: string): Buffer;
export declare function encode(key: Buffer): string;

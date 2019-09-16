/// <reference types="node" />
export interface KeyBuffer {
    publicKey: Buffer;
    secretKey?: Buffer;
}
export interface KeyPair {
    publicKey: string;
    secretKey?: string;
}
export declare function create(): Required<KeyPair>;
export declare function decodePair(keys: KeyPair): KeyBuffer;
export declare function encodePair(keys: KeyBuffer): KeyPair;
export declare function decode(key: string): Buffer;
export declare function encode(key: Buffer): string;

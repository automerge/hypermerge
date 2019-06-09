export interface KeyBuffer {
    publicKey: Buffer;
    secretKey?: Buffer;
}
export declare function decode(key: string): Buffer;
export declare function encode(key: Buffer): string;

import * as Base58 from "bs58";


export interface KeyBuffer {
    publicKey: Buffer;
    secretKey?: Buffer;
}

export function decode(key: string): Buffer {
    return Base58.decode(key)
}

export function encode(key: Buffer): string {
    return Base58.encode(key)
}
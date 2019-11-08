import { Key, PublicKey, SecretKey, DiscoveryKey, discoveryKey } from 'hypercore-crypto';
import * as Crypto from './Crypto';
export { Key, PublicKey, SecretKey, DiscoveryKey, discoveryKey };
export declare type KeyId = Crypto.EncodedPublicSigningKey;
export declare type PublicId = KeyId & {
    __publicId: true;
};
export declare type SecretId = KeyId & {
    __secretId: true;
};
export declare type DiscoveryId = KeyId & {
    __discoveryId: true;
};
export interface KeyBuffer {
    publicKey: PublicKey;
    secretKey?: SecretKey;
}
export interface KeyPair {
    publicKey: PublicId;
    secretKey?: SecretId;
}
export declare function create(): Required<KeyPair>;
export declare function createBuffer(): Required<KeyBuffer>;
export declare function decodePair(keys: KeyPair): KeyBuffer;
export declare function encodePair(keys: Required<KeyBuffer>): Required<KeyPair>;
export declare function encodePair(keys: KeyBuffer): KeyPair;
export declare function decode(key: DiscoveryId): DiscoveryKey;
export declare function decode(key: SecretId): SecretKey;
export declare function decode(key: PublicId): PublicKey;
export declare function decode(key: KeyId): Key;
export declare function encode(key: DiscoveryKey): DiscoveryId;
export declare function encode(key: SecretKey): SecretId;
export declare function encode(key: PublicKey): PublicId;
export declare function encode(key: Key): KeyId;

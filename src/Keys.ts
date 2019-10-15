import * as Base58 from 'bs58'
import * as crypto from 'hypercore-crypto'
import { Key, PublicKey, SecretKey, DiscoveryKey, discoveryKey } from 'hypercore-crypto'

export { Key, PublicKey, SecretKey, DiscoveryKey, discoveryKey }

export type EncodedKeyId = string & { __encodedKeyId: true }
export type PublicId = EncodedKeyId & { __publicId: true }
export type SecretId = EncodedKeyId & { __secretId: true }
export type DiscoveryId = EncodedKeyId & { __discoveryId: true }

export interface KeyBuffer {
  publicKey: PublicKey
  secretKey?: SecretKey
}

export interface KeyPair {
  publicKey: PublicId
  secretKey?: SecretId
}

export function create(): Required<KeyPair> {
  return encodePair(crypto.keyPair())
}

export function createBuffer(): Required<KeyBuffer> {
  return crypto.keyPair()
}

export function decodePair(keys: KeyPair): KeyBuffer {
  return {
    publicKey: decode(keys.publicKey),
    secretKey: keys.secretKey ? decode(keys.secretKey) : undefined,
  }
}

export function encodePair(keys: Required<KeyBuffer>): Required<KeyPair>
export function encodePair(keys: KeyBuffer): KeyPair
export function encodePair(keys: KeyBuffer): KeyPair {
  return {
    publicKey: encode(keys.publicKey),
    secretKey: keys.secretKey ? encode(keys.secretKey) : undefined,
  }
}

export function decode(key: DiscoveryId): DiscoveryKey
export function decode(key: SecretId): SecretKey
export function decode(key: PublicId): PublicKey
export function decode(key: EncodedKeyId): Key
export function decode(key: string): Buffer {
  return Base58.decode(key)
}

export function encode(key: DiscoveryKey): DiscoveryId
export function encode(key: SecretKey): SecretId
export function encode(key: PublicKey): PublicId
export function encode(key: Key): EncodedKeyId
export function encode(key: Buffer): string {
  return Base58.encode(key)
}

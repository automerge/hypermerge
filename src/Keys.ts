import * as Base58 from 'bs58'
import * as crypto from 'hypercore/lib/crypto'

export interface KeyBuffer {
  publicKey: Buffer
  secretKey?: Buffer
}

export interface KeyPair {
  publicKey: string
  secretKey?: string
}

export function create(): Required<KeyPair> {
  return encodePair(crypto.keyPair()) as Required<KeyPair>
}

export function createBuffer(): Required<KeyBuffer> {
  return crypto.keyPair() as Required<KeyBuffer>
}

export function decodePair(keys: KeyPair): KeyBuffer {
  return {
    publicKey: decode(keys.publicKey),
    secretKey: keys.secretKey ? decode(keys.secretKey) : undefined,
  }
}

export function encodePair(keys: KeyBuffer): KeyPair {
  return {
    publicKey: encode(keys.publicKey),
    secretKey: keys.secretKey ? encode(keys.secretKey) : undefined,
  }
}

export function decode(key: string): Buffer {
  return Base58.decode(key)
}

export function encode(key: Buffer): string {
  return Base58.encode(key)
}

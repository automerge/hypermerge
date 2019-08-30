import * as Base58 from 'bs58'
import * as crypto from 'hypercore/lib/crypto'

export interface KeyBuffer {
  publicKey: Buffer
  secretKey?: Buffer
}

export interface KeyPair {
  publicKey: string
  secretKey: string
}

export function create(): KeyPair {
  const keys = crypto.keyPair()
  return {
    publicKey: encode(keys.publicKey),
    secretKey: encode(keys.secretKey),
  }
}

export function decode(key: string): Buffer {
  return Base58.decode(key)
}

export function encode(key: Buffer): string {
  return Base58.encode(key)
}

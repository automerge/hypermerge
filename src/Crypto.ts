import sodium from 'sodium-native'
import * as Base58 from 'bs58'

export type EncodedPublicKey = string & { __encodedPublicKey: true }
export type EncodedSecretKey = string & { __encodedSecretKey: true }
export interface EncodedKeyPair {
  publicKey: EncodedPublicKey
  secretKey: EncodedSecretKey
}

export type EncodedPublicSigningKey = EncodedPublicKey & { __encodedPublicSigningKey: true }
export type EncodedSecretSigningKey = EncodedSecretKey & { __encodedSecretSigningKey: true }
export interface EncodedSigningKeyPair extends EncodedKeyPair {
  publicKey: EncodedPublicSigningKey
  secretKey: EncodedSecretSigningKey
}

export type EncodedPublicEncryptionKey = EncodedPublicKey & { __encodedPublicEncryptionKey: true }
export type EncodedSecretEncryptionKey = EncodedSecretKey & { __encodedSecretEncryptionKey: true }
export interface EncodedEncryptionKeyPair extends EncodedKeyPair {
  publicKey: EncodedPublicEncryptionKey
  secretKey: EncodedSecretEncryptionKey
}

export type EncodedSignature = string & { __encodedSignature: true }
export type EncodedSealedBox = string & { __encodedSealedBox: true }
export type EncodedBox = string & { __encodedBox: true }

export function encodedSigningKeyPair(): EncodedSigningKeyPair {
  return encodePair(signingKeyPair())
}

export function signingKeyPair(): sodium.SigningKeyPair {
  const publicKey = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES) as sodium.PublicSigningKey
  const secretKey = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES) as sodium.SecretSigningKey
  sodium.crypto_sign_keypair(publicKey, secretKey)
  return { publicKey, secretKey }
}

export function encodedEncryptionKeyPair(): EncodedEncryptionKeyPair {
  return encodePair(encryptionKeyPair())
}

export function encryptionKeyPair(): sodium.EncryptionKeyPair {
  const publicKey = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES) as sodium.PublicEncryptionKey
  const secretKey = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES) as sodium.SecretEncryptionKey
  sodium.crypto_box_keypair(publicKey, secretKey)
  return { publicKey, secretKey }
}

export function sign(secretKey: EncodedSecretSigningKey, message: Buffer): EncodedSignature {
  const secretKeyBuffer = decode(secretKey)
  const signatureBuffer = Buffer.alloc(sodium.crypto_sign_BYTES) as sodium.Signature
  sodium.crypto_sign_detached(signatureBuffer, message, secretKeyBuffer)
  return encode(signatureBuffer)
}

export function verify(
  publicKey: EncodedPublicSigningKey,
  message: Buffer,
  signature: EncodedSignature
): boolean {
  const publicKeyBuffer = decode(publicKey)
  const signatureBuffer = decode(signature)
  return sodium.crypto_sign_verify_detached(signatureBuffer, message, publicKeyBuffer)
}

export function sealedBox(
  publicKey: EncodedPublicEncryptionKey,
  message: Buffer
): EncodedSealedBox {
  const sealedBox = Buffer.alloc(message.length + sodium.crypto_box_SEALBYTES) as sodium.SealedBox
  sodium.crypto_box_seal(sealedBox, message, decode(publicKey))
  return encode(sealedBox)
}

export function openSealedBox(
  keyPair: EncodedEncryptionKeyPair,
  sealedBox: EncodedSealedBox
): Buffer {
  const keyPairBuffer = decodePair(keyPair)
  const sealedBoxBuffer = decode(sealedBox)
  const message = Buffer.alloc(sealedBoxBuffer.length - sodium.crypto_box_SEALBYTES)
  const success = sodium.crypto_box_seal_open(
    message,
    sealedBoxBuffer,
    keyPairBuffer.publicKey,
    keyPairBuffer.secretKey
  )
  if (!success) throw new Error('Unable to open sealed box')
  return message
}

export function encode(val: sodium.PublicSigningKey): EncodedPublicSigningKey
export function encode(val: sodium.SecretSigningKey): EncodedSecretSigningKey
export function encode(val: sodium.PublicEncryptionKey): EncodedPublicEncryptionKey
export function encode(val: sodium.SecretEncryptionKey): EncodedSecretSigningKey
export function encode(val: sodium.Signature): EncodedSignature
export function encode(val: sodium.SealedBox): EncodedSealedBox
export function encode(val: Buffer): string
export function encode(val: Buffer): string {
  return Base58.encode(val)
}

export function decode(val: EncodedPublicSigningKey): sodium.PublicSigningKey
export function decode(val: EncodedSecretSigningKey): sodium.SecretSigningKey
export function decode(val: EncodedPublicEncryptionKey): sodium.PublicEncryptionKey
export function decode(val: EncodedSecretEncryptionKey): sodium.SecretSigningKey
export function decode(val: EncodedSignature): sodium.Signature
export function decode(val: EncodedSealedBox): sodium.SealedBox
export function decode(val: string): Buffer
export function decode(val: string): Buffer {
  return Base58.decode(val)
}

export function decodePair(pair: EncodedEncryptionKeyPair): sodium.EncryptionKeyPair
export function decodePair(pair: EncodedSigningKeyPair): sodium.SigningKeyPair
export function decodePair(pair: EncodedKeyPair): sodium.KeyPair
export function decodePair(pair: EncodedKeyPair): sodium.KeyPair {
  return {
    publicKey: Base58.decode(pair.publicKey),
    secretKey: Base58.decode(pair.secretKey),
  } as sodium.KeyPair
}

export function encodePair(pair: sodium.EncryptionKeyPair): EncodedEncryptionKeyPair
export function encodePair(pair: sodium.SigningKeyPair): EncodedSigningKeyPair
export function encodePair(pair: sodium.KeyPair): EncodedKeyPair
export function encodePair(pair: sodium.KeyPair): EncodedKeyPair {
  return {
    publicKey: Base58.encode(pair.publicKey),
    secretKey: Base58.encode(pair.secretKey),
  } as EncodedKeyPair
}

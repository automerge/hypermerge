declare module 'sodium-native' {
  export type Key = Buffer & { __key: true }
  export type PublicKey = Key & { __publicKey: true }
  export type SecretKey = Key & { __secretKey: true }
  export interface KeyPair {
    publicKey: PublicKey
    secretKey: SecretKey
  }

  export type PublicSigningKey = PublicKey & { __publicSigningKey: true }
  export type SecretSigningKey = SecretKey & { __secretSigningKey: true }
  export interface SigningKeyPair extends KeyPair {
    publicKey: PublicSigningKey
    secretKey: SecretSigningKey
  }

  export type PublicEncryptionKey = PublicKey & { __publicEncryptionKey: true }
  export type SecretEncryptionKey = SecretKey & { __secretEncryptionKey: true }
  export interface EncryptionKeyPair extends KeyPair {
    publicKey: PublicEncryptionKey
    secretKey: SecretEncryptionKey
  }

  export type Signature = Buffer & { __signature: true }
  export type SealedBox = Buffer & { __sealedBox: true }
  export type Box = Buffer & { __box: true }
  export type BoxNonce = Buffer & { __nonce: true }

  export const crypto_sign_BYTES: number
  export const crypto_box_SEALBYTES: number
  export const crypto_sign_PUBLICKEYBYTES: number
  export const crypto_sign_SECRETKEYBYTES: number
  export const crypto_box_PUBLICKEYBYTES: number
  export const crypto_box_SECRETKEYBYTES: number
  export const crypto_box_NONCEBYTES: number
  export const crypto_box_MACBYTES: number

  export function randombytes_buf(buffer: Buffer): Buffer

  export function crypto_sign_keypair(
    publicKey: PublicSigningKey,
    secretKey: SecretSigningKey
  ): void

  export function crypto_box_keypair(
    publicKey: PublicEncryptionKey,
    secretKey: SecretEncryptionKey
  ): void

  export function crypto_sign_detached(
    signature: Signature,
    message: Buffer,
    secretKey: SecretSigningKey
  ): void

  export function crypto_sign_verify_detached(
    signature: Signature,
    message: Buffer,
    publicKey: PublicSigningKey
  ): boolean

  export function crypto_box_seal(
    ciphertext: SealedBox,
    message: Buffer,
    publicKey: PublicEncryptionKey
  ): void

  export function crypto_box_seal_open(
    message: Buffer,
    ciphertext: SealedBox,
    publicKey: PublicEncryptionKey,
    secretKey: SecretEncryptionKey
  ): boolean

  export function crypto_box_easy(
    ciphertext: Box,
    message: Buffer,
    nonce: BoxNonce,
    publicKey: PublicEncryptionKey,
    secretKey: SecretEncryptionKey
  )

  export function crypto_box_open_easy(
    message: Buffer,
    ciphertext: Box,
    nonce: BoxNonce,
    publicKey: PublicEncryptionKey,
    secretKey: SecretEncryptionKey
  ): boolean
}

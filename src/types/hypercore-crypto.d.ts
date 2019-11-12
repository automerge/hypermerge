declare module 'hypercore-crypto' {
  import sodium from 'sodium-native'
  export type Key = sodium.Key
  export type PublicKey = sodium.PublicSigningKey
  export type SecretKey = sodium.SecretSigningKey
  export type DiscoveryKey = Key & { __discoveryKey: true }
  export type KeyPair = sodium.SigningKeyPair

  /** Returns an ED25519 keypair that can used for tree signing. */
  export function keyPair(): KeyPair

  /** Signs a message (buffer). */
  export function sign(message: Buffer, secretKey: SecretKey): Buffer

  /** Verifies a signature for a message. */
  export function verify(message: Buffer, signature: Buffer, publicKey: PublicKey): boolean

  /** Returns a buffer containing random bytes of size `size`. */
  export function randomBytes(size: number): Buffer

  /**
   * Return a hash derived from a `publicKey` that can used for discovery without disclosing the
   * public key.
   */
  export function discoveryKey(publicKey: PublicKey): DiscoveryKey
}

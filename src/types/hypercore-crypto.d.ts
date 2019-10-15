declare module 'hypercore-crypto' {
  export type Key = Buffer & { __key: true }
  export type PublicKey = Key & { __publicKey: true }
  export type SecretKey = Key & { __secretKey: true }
  export type DiscoveryKey = Key & { __discoveryKey: true }

  export interface KeyPair {
    publicKey: PublicKey
    secretKey: SecretKey
  }

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

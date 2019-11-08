import test from 'tape'
import * as Crypto from '../src/Crypto'

test('Test sign and verify', (t) => {
  t.plan(1)
  const keyPair = Crypto.encodedSigningKeyPair()
  const message = 'test message'
  const signature = Crypto.sign(keyPair.secretKey, Buffer.from(message))
  const success = Crypto.verify(keyPair.publicKey, Buffer.from(message), signature)
  t.true(success)
})

test('Test verify fails with wrong signature', (t) => {
  t.plan(1)
  const keyPair = Crypto.encodedSigningKeyPair()
  const message = 'test message'
  const message2 = 'test message 2'
  const signature2 = Crypto.sign(keyPair.secretKey, Buffer.from(message2))
  const success = Crypto.verify(keyPair.publicKey, Buffer.from(message), signature2)
  t.false(success)
})

// Note: this is mainly to document behavior.
test('Test verify throws with garbage signature', (t) => {
  t.plan(1)
  const keyPair = Crypto.encodedSigningKeyPair()
  const message = 'test message'
  const signature = 'contains non-base58 characters' as Crypto.EncodedSignature
  t.throws(() => Crypto.verify(keyPair.publicKey, Buffer.from(message), signature))
})

test('Test sealedBox and openSealedBox', (t) => {
  t.plan(1)
  const keyPair = Crypto.encodedEncryptionKeyPair()
  const message = 'test message'
  const sealedBox = Crypto.sealedBox(keyPair.publicKey, Buffer.from(message))
  const openedMessage = Crypto.openSealedBox(keyPair, sealedBox)
  t.equal(openedMessage.toString(), message)
})

test('Test openSealedBox throws with wrong key pair', (t) => {
  t.plan(1)
  const keyPair = Crypto.encodedEncryptionKeyPair()
  const keyPair2 = Crypto.encodedEncryptionKeyPair()
  const message = 'test message'
  const sealedBox = Crypto.sealedBox(keyPair.publicKey, Buffer.from(message))
  t.throws(() => Crypto.openSealedBox(keyPair2, sealedBox))
})

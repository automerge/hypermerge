import * as Crypto from './Crypto'
import { DocUrl } from './Misc'
import { validateDocURL } from './Metadata'
import {
  SignReplyMsg,
  VerifyReplyMsg,
  SealedBoxReplyMsg,
  OpenSealedBoxReplyMsg,
  EncryptionKeyPairReplyMsg,
  ToBackendQueryMsg,
  BoxReplyMsg,
  OpenBoxReplyMsg,
} from './RepoMsg'

export type RequestFn = (msg: ToBackendQueryMsg, cb: (msg: any) => void) => void

export default class CryptoClient {
  request: RequestFn

  constructor(request: RequestFn) {
    this.request = request
  }

  sign<T extends string>(url: DocUrl, message: T): Promise<Crypto.SignedMessage<T>> {
    return new Promise((res, rej) => {
      const docId = validateDocURL(url)
      this.request({ type: 'SignMsg', docId, message }, (msg: SignReplyMsg) => {
        if (msg.success) return res(msg.signedMessage as Crypto.SignedMessage<T>)
        rej(msg.error)
      })
    })
  }

  verify(url: DocUrl, signedMessage: Crypto.SignedMessage<string>): Promise<boolean> {
    return new Promise((res) => {
      const docId = validateDocURL(url)
      this.request(
        {
          type: 'VerifyMsg',
          docId,
          signedMessage,
        },
        (msg: VerifyReplyMsg) => {
          res(msg.success)
        }
      )
    })
  }

  /**
   * Helper function to extract the message from a SignedMessage.
   * Verifies the signature and returns the message if valid, otherwise rejects.
   */
  async verifiedMessage<T extends string>(
    url: DocUrl,
    signedMessage: Crypto.SignedMessage<T>
  ): Promise<T> {
    const verified = this.verify(url, signedMessage)
    if (!verified) throw new Error('Could not verify signedMessage')
    return signedMessage.message
  }

  box(
    senderSecretKey: Crypto.EncodedSecretEncryptionKey,
    recipientPublicKey: Crypto.EncodedPublicEncryptionKey,
    message: string
  ): Promise<Crypto.Box> {
    return new Promise((res, rej) => {
      this.request(
        { type: 'BoxMsg', senderSecretKey, recipientPublicKey, message },
        (msg: BoxReplyMsg) => {
          if (msg.success) return res(msg.box)
          rej(msg.error)
        }
      )
    })
  }

  openBox(
    senderPublicKey: Crypto.EncodedPublicEncryptionKey,
    recipientSecretKey: Crypto.EncodedSecretEncryptionKey,
    box: Crypto.Box
  ): Promise<string> {
    return new Promise((res, rej) => {
      this.request(
        { type: 'OpenBoxMsg', senderPublicKey, recipientSecretKey, box: box },
        (msg: OpenBoxReplyMsg) => {
          if (msg.success) return res(msg.message)
          rej(msg.error)
        }
      )
    })
  }

  sealedBox(
    publicKey: Crypto.EncodedPublicEncryptionKey,
    message: string
  ): Promise<Crypto.EncodedSealedBoxCiphertext> {
    return new Promise((res, rej) => {
      this.request({ type: 'SealedBoxMsg', publicKey, message }, (msg: SealedBoxReplyMsg) => {
        if (msg.success) return res(msg.sealedBox)
        rej(msg.error)
      })
    })
  }

  openSealedBox(
    keyPair: Crypto.EncodedEncryptionKeyPair,
    sealedBox: Crypto.EncodedSealedBoxCiphertext
  ): Promise<string> {
    return new Promise((res, rej) => {
      this.request(
        { type: 'OpenSealedBoxMsg', keyPair, sealedBox },
        (msg: OpenSealedBoxReplyMsg) => {
          if (msg.success) return res(msg.message)
          rej(msg.error)
        }
      )
    })
  }

  encryptionKeyPair(): Promise<Crypto.EncodedEncryptionKeyPair> {
    return new Promise((res, rej) => {
      this.request({ type: 'EncryptionKeyPairMsg' }, (msg: EncryptionKeyPairReplyMsg) => {
        if (msg.success) return res(msg.keyPair)
        rej(msg.error)
      })
    })
  }
}

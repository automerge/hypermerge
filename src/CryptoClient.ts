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

export interface SignedValue<T extends string> {
  value: T
  signature: Crypto.EncodedSignature
}

export default class CryptoClient {
  request: RequestFn
  constructor(request: RequestFn) {
    this.request = request
  }
  sign<T extends string>(url: DocUrl, value: T): Promise<SignedValue<T>> {
    return new Promise((res, rej) => {
      const docId = validateDocURL(url)
      this.request({ type: 'SignMsg', docId, message: value }, (msg: SignReplyMsg) => {
        if (msg.success) return res({ value, signature: msg.signature })
        rej()
      })
    })
  }

  verify<T extends string>(url: DocUrl, signedValue: SignedValue<T>): Promise<boolean> {
    return new Promise((res) => {
      const docId = validateDocURL(url)
      this.request(
        { type: 'VerifyMsg', docId, message: signedValue.value, signature: signedValue.signature },
        (msg: VerifyReplyMsg) => {
          res(msg.success)
        }
      )
    })
  }

  box(
    senderSecretKey: Crypto.EncodedSecretEncryptionKey,
    recipientPublicKey: Crypto.EncodedPublicEncryptionKey,
    message: string
  ): Promise<[Crypto.EncodedBox, Crypto.EncodedBoxNonce]> {
    return new Promise((res, rej) => {
      this.request(
        { type: 'BoxMsg', senderSecretKey, recipientPublicKey, message },
        (msg: BoxReplyMsg) => {
          if (msg.success) return res([msg.box, msg.nonce])
          rej()
        }
      )
    })
  }

  openBox(
    senderPublicKey: Crypto.EncodedPublicEncryptionKey,
    recipientSecretKey: Crypto.EncodedSecretEncryptionKey,
    box: Crypto.EncodedBox,
    nonce: Crypto.EncodedBoxNonce
  ): Promise<string> {
    return new Promise((res, rej) => {
      this.request(
        { type: 'OpenBoxMsg', senderPublicKey, recipientSecretKey, box, nonce },
        (msg: OpenBoxReplyMsg) => {
          if (msg.success) return res(msg.message)
          rej()
        }
      )
    })
  }

  sealedBox(
    publicKey: Crypto.EncodedPublicEncryptionKey,
    message: string
  ): Promise<Crypto.EncodedSealedBox> {
    return new Promise((res, rej) => {
      this.request({ type: 'SealedBoxMsg', publicKey, message }, (msg: SealedBoxReplyMsg) => {
        if (msg.success) return res(msg.sealedBox)
        rej()
      })
    })
  }

  openSealedBox(
    keyPair: Crypto.EncodedEncryptionKeyPair,
    sealedBox: Crypto.EncodedSealedBox
  ): Promise<string> {
    return new Promise((res, rej) => {
      this.request(
        { type: 'OpenSealedBoxMsg', keyPair, sealedBox },
        (msg: OpenSealedBoxReplyMsg) => {
          if (msg.success) return res(msg.message)
          rej()
        }
      )
    })
  }

  encryptionKeyPair(): Promise<Crypto.EncodedEncryptionKeyPair> {
    return new Promise((res, rej) => {
      this.request({ type: 'EncryptionKeyPairMsg' }, (msg: EncryptionKeyPairReplyMsg) => {
        if (msg.success) return res(msg.keyPair)
        rej()
      })
    })
  }
}

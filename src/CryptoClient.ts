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
} from './RepoMsg'

export type RequestFn = (msg: ToBackendQueryMsg, cb: (msg: any) => void) => void

export default class CryptoClient {
  request: RequestFn
  constructor(request: RequestFn) {
    this.request = request
  }
  sign = (url: DocUrl, message: string): Promise<Crypto.EncodedSignature> => {
    return new Promise((res, rej) => {
      const docId = validateDocURL(url)
      this.request({ type: 'SignMsg', docId, message }, (msg: SignReplyMsg) => {
        if (msg.success) return res(msg.signature)
        rej()
      })
    })
  }

  verify = (url: DocUrl, message: string, signature: Crypto.EncodedSignature): Promise<boolean> => {
    return new Promise((res) => {
      const docId = validateDocURL(url)
      this.request({ type: 'VerifyMsg', docId, message, signature }, (msg: VerifyReplyMsg) => {
        res(msg.success)
      })
    })
  }

  sealedBox = (
    publicKey: Crypto.EncodedPublicEncryptionKey,
    message: string
  ): Promise<Crypto.EncodedSealedBox> => {
    return new Promise((res, rej) => {
      this.request({ type: 'SealedBoxMsg', publicKey, message }, (msg: SealedBoxReplyMsg) => {
        if (msg.success) return res(msg.sealedBox)
        rej()
      })
    })
  }

  openSealedBox = (
    keyPair: Crypto.EncodedEncryptionKeyPair,
    sealedBox: Crypto.EncodedSealedBox
  ): Promise<string> => {
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

  encryptionKeyPair = (): Promise<Crypto.EncodedEncryptionKeyPair> => {
    return new Promise((res, rej) => {
      this.request({ type: 'EncryptionKeyPairMsg' }, (msg: EncryptionKeyPairReplyMsg) => {
        if (msg.success) return res(msg.keyPair)
        rej()
      })
    })
  }
}

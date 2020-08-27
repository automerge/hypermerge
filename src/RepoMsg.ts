import { Patch, Change, Request, RegisteredLens } from 'cambria-automerge'
import { PublicMetadata } from './Metadata'
import { DocId, HyperfileId, ActorId } from './Misc'
import { PublicId, SecretId } from './Keys'
import * as Crypto from './Crypto'

export type ToBackendQueryMsg =
  | MaterializeMsg
  | MetadataMsg
  | SignMsg
  | VerifyMsg
  | BoxMsg
  | OpenBoxMsg
  | SealedBoxMsg
  | OpenSealedBoxMsg
  | EncryptionKeyPairMsg

export type ToFrontendReplyMsg =
  | MaterializeReplyMsg
  | MetadataReplyMsg
  | SignReplyMsg
  | VerifyReplyMsg
  | BoxReplyMsg
  | OpenBoxReplyMsg
  | SealedBoxReplyMsg
  | OpenSealedBoxReplyMsg
  | EncryptionKeyPairReplyMsg

export type ToBackendRepoMsg =
  | RegisterLensMsg
  | NeedsActorIdMsg
  | RequestMsg
  | CloseMsg
  //  | FollowMsg
  | MergeMsg
  | CreateMsg
  | OpenMsg
  | DocumentMsg
  | DestroyMsg
  | DebugMsg
  | QueryMsg
//  | MaterializeMsg

export interface QueryMsg {
  type: 'Query'
  id: number
  query: ToBackendQueryMsg
}

export interface ReplyMsg {
  type: 'Reply'
  id: number
  payload: ToFrontendReplyMsg // PublicMetadata | Patch
  //  reply: ToFrontendReplyMsg;
}

export interface MaterializeMsg {
  type: 'MaterializeMsg'
  id: DocId
  history: number
}

export interface MetadataMsg {
  type: 'MetadataMsg'
  id: DocId | HyperfileId
}

export interface SealedBoxMsg {
  type: 'SealedBoxMsg'
  publicKey: Crypto.EncodedPublicEncryptionKey
  message: string
}

export type SealedBoxReplyMsg = SealedBoxSuccessReplyMsg | SealedBoxErrorReplyMsg

export interface SealedBoxSuccessReplyMsg {
  type: 'SealedBoxReplyMsg'
  success: true
  sealedBox: Crypto.EncodedSealedBoxCiphertext
}

export interface SealedBoxErrorReplyMsg {
  type: 'SealedBoxReplyMsg'
  success: false
  error: string
}

export interface OpenSealedBoxMsg {
  type: 'OpenSealedBoxMsg'
  keyPair: Crypto.EncodedEncryptionKeyPair
  sealedBox: Crypto.EncodedSealedBoxCiphertext
}

export type OpenSealedBoxReplyMsg = OpenSealedBoxSuccessMsg | OpenSealedBoxErrorMsg

export interface OpenSealedBoxSuccessMsg {
  type: 'OpenSealedBoxReplyMsg'
  success: true
  message: string
}

export interface OpenSealedBoxErrorMsg {
  type: 'OpenSealedBoxReplyMsg'
  success: false
  error: string
}

export interface BoxMsg {
  type: 'BoxMsg'
  message: string
  recipientPublicKey: Crypto.EncodedPublicEncryptionKey
  senderSecretKey: Crypto.EncodedSecretEncryptionKey
}

export type BoxReplyMsg = BoxSuccessReplyMsg | BoxErrorReplyMsg

export interface BoxSuccessReplyMsg {
  type: 'BoxReplyMsg'
  success: true
  box: Crypto.Box
}

export interface BoxErrorReplyMsg {
  type: 'BoxReplyMsg'
  success: false
  error: string
}

export interface OpenBoxMsg {
  type: 'OpenBoxMsg'
  box: Crypto.Box
  recipientSecretKey: Crypto.EncodedSecretEncryptionKey
  senderPublicKey: Crypto.EncodedPublicEncryptionKey
}

export type OpenBoxReplyMsg = OpenBoxSuccessReplyMsg | OpenBoxErrorReplyMsg

export interface OpenBoxSuccessReplyMsg {
  type: 'OpenBoxReplyMsg'
  success: true
  message: string
}

export interface OpenBoxErrorReplyMsg {
  type: 'OpenBoxReplyMsg'
  success: false
  error: string
}

export interface EncryptionKeyPairMsg {
  type: 'EncryptionKeyPairMsg'
}

export type EncryptionKeyPairReplyMsg =
  | EncryptionKeyPairSuccessReplyMsg
  | EncryptionKeyPairErrorReplyMsg

export interface EncryptionKeyPairSuccessReplyMsg {
  type: 'EncryptionKeyPairReplyMsg'
  success: true
  keyPair: Crypto.EncodedEncryptionKeyPair
}

export interface EncryptionKeyPairErrorReplyMsg {
  type: 'EncryptionKeyPairReplyMsg'
  success: false
  error: string
}

export interface SignMsg {
  type: 'SignMsg'
  docId: DocId
  message: string
}

export type SignReplyMsg = SignSuccessReplyMsg | SignErrorReplyMsg

export interface SignSuccessReplyMsg {
  type: 'SignReplyMsg'
  success: true
  signedMessage: Crypto.SignedMessage<string>
}

export interface SignErrorReplyMsg {
  type: 'SignReplyMsg'
  success: false
  error: string
}

export interface VerifyMsg {
  type: 'VerifyMsg'
  docId: DocId
  signedMessage: Crypto.SignedMessage<string>
}

export interface VerifyReplyMsg {
  type: 'VerifyReplyMsg'
  success: boolean
}

export interface CreateMsg {
  type: 'CreateMsg'
  publicKey: PublicId
  secretKey: SecretId
  schema?: string
}

export interface MergeMsg {
  type: 'MergeMsg'
  id: DocId
  actors: string[] // ActorId | `${ActorId}:${seq}` (result of clock2strs function)
}

export interface RegisterLensMsg {
  type: 'RegisterLensMsg'
  lens: RegisteredLens
}

/*
export interface FollowMsg {
  type: "FollowMsg";
  id: string;
  target: string;
}
*/

export interface DebugMsg {
  type: 'DebugMsg'
  id: DocId
}

export interface OpenMsg {
  type: 'OpenMsg'
  id: DocId
  schema?: string
}

export interface DestroyMsg {
  type: 'DestroyMsg'
  id: DocId
}

export interface NeedsActorIdMsg {
  type: 'NeedsActorIdMsg'
  id: DocId
}

export interface RequestMsg {
  type: 'RequestMsg'
  id: DocId
  request: Request
}

export type ToFrontendRepoMsg =
  | PatchMsg
  | ActorBlockDownloadedMsg
  | ActorIdMsg
  | ReadyMsg
  | ReplyMsg
  | DocumentMsg
  | FileServerReadyMsg

export interface PatchMsg {
  type: 'PatchMsg'
  id: DocId
  minimumClockSatisfied: boolean
  patch: Patch
  history: number
}

export interface DocumentMsg {
  type: 'DocumentMessage'
  id: DocId
  contents: any
}

export interface MaterializeReplyMsg {
  type: 'MaterializeReplyMsg'
  patch: Patch
}

export interface MetadataReplyMsg {
  type: 'MetadataReplyMsg'
  metadata: PublicMetadata | null
}

export interface ActorIdMsg {
  type: 'ActorIdMsg'
  id: DocId
  actorId: ActorId
}

export interface CloseMsg {
  type: 'CloseMsg'
}

export interface ReadyMsg {
  type: 'ReadyMsg'
  id: DocId
  minimumClockSatisfied: boolean
  actorId?: ActorId
  patch?: Patch
  history?: number
}

export interface ActorBlockDownloadedMsg {
  type: 'ActorBlockDownloadedMsg'
  id: DocId
  actorId: ActorId
  index: number
  size: number
  time: number
}

export interface FileServerReadyMsg {
  type: 'FileServerReadyMsg'
  path: string
}

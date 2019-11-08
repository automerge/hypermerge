import { Patch, Change } from 'automerge';
import { PublicMetadata } from './Metadata';
import { DocId, HyperfileId, ActorId } from './Misc';
import { PublicId, SecretId } from './Keys';
import * as Crypto from './Crypto';
export declare type ToBackendQueryMsg = MaterializeMsg | MetadataMsg | SignMsg | VerifyMsg | SealedBoxMsg | OpenSealedBoxMsg | EncryptionKeyPairMsg;
export declare type ToFrontendReplyMsg = MaterializeReplyMsg | MetadataReplyMsg | SignReplyMsg | VerifyReplyMsg | SealedBoxReplyMsg | OpenSealedBoxReplyMsg | EncryptionKeyPairReplyMsg;
export declare type ToBackendRepoMsg = NeedsActorIdMsg | RequestMsg | CloseMsg | MergeMsg | CreateMsg | OpenMsg | DocumentMsg | DestroyMsg | DebugMsg | QueryMsg;
export interface QueryMsg {
    type: 'Query';
    id: number;
    query: ToBackendQueryMsg;
}
export interface ReplyMsg {
    type: 'Reply';
    id: number;
    payload: ToFrontendReplyMsg;
}
export interface MaterializeMsg {
    type: 'MaterializeMsg';
    id: DocId;
    history: number;
}
export interface MetadataMsg {
    type: 'MetadataMsg';
    id: DocId | HyperfileId;
}
export interface SealedBoxMsg {
    type: 'SealedBoxMsg';
    publicKey: Crypto.EncodedPublicEncryptionKey;
    message: string;
}
export declare type SealedBoxReplyMsg = SealedBoxSuccessReplyMsg | SealedBoxErrorReplyMsg;
export interface SealedBoxSuccessReplyMsg {
    type: 'SealedBoxReplyMsg';
    success: true;
    sealedBox: Crypto.EncodedSealedBox;
}
export interface SealedBoxErrorReplyMsg {
    type: 'SealedBoxReplyMsg';
    success: false;
}
export interface OpenSealedBoxMsg {
    type: 'OpenSealedBoxMsg';
    keyPair: Crypto.EncodedEncryptionKeyPair;
    sealedBox: Crypto.EncodedSealedBox;
}
export declare type OpenSealedBoxReplyMsg = OpenSealedBoxSuccessMsg | OpenSealedBoxErrorMsg;
export interface OpenSealedBoxSuccessMsg {
    type: 'OpenSealedBoxReplyMsg';
    success: true;
    message: string;
}
export interface OpenSealedBoxErrorMsg {
    type: 'OpenSealedBoxReplyMsg';
    success: false;
}
export interface EncryptionKeyPairMsg {
    type: 'EncryptionKeyPairMsg';
}
export declare type EncryptionKeyPairReplyMsg = EncryptionKeyPairSuccessReplyMsg | EncryptionKeyPairErrorReplyMsg;
export interface EncryptionKeyPairSuccessReplyMsg {
    type: 'EncryptionKeyPairReplyMsg';
    success: true;
    keyPair: Crypto.EncodedEncryptionKeyPair;
}
export interface EncryptionKeyPairErrorReplyMsg {
    type: 'EncryptionKeyPairReplyMsg';
    success: false;
}
export interface SignMsg {
    type: 'SignMsg';
    docId: DocId;
    message: string;
}
export declare type SignReplyMsg = SignSuccessReplyMsg | SignErrorReplyMsg;
export interface SignSuccessReplyMsg {
    type: 'SignReplyMsg';
    success: true;
    signature: Crypto.EncodedSignature;
}
export interface SignErrorReplyMsg {
    type: 'SignReplyMsg';
    success: false;
}
export interface VerifyMsg {
    type: 'VerifyMsg';
    docId: DocId;
    message: string;
    signature: Crypto.EncodedSignature;
}
export interface VerifyReplyMsg {
    type: 'VerifyReplyMsg';
    success: boolean;
}
export interface CreateMsg {
    type: 'CreateMsg';
    publicKey: PublicId;
    secretKey: SecretId;
}
export interface MergeMsg {
    type: 'MergeMsg';
    id: DocId;
    actors: string[];
}
export interface DebugMsg {
    type: 'DebugMsg';
    id: DocId;
}
export interface OpenMsg {
    type: 'OpenMsg';
    id: DocId;
}
export interface DestroyMsg {
    type: 'DestroyMsg';
    id: DocId;
}
export interface NeedsActorIdMsg {
    type: 'NeedsActorIdMsg';
    id: DocId;
}
export interface RequestMsg {
    type: 'RequestMsg';
    id: DocId;
    request: Change;
}
export declare type ToFrontendRepoMsg = PatchMsg | ActorBlockDownloadedMsg | ActorIdMsg | ReadyMsg | ReplyMsg | DocumentMsg | FileServerReadyMsg;
export interface PatchMsg {
    type: 'PatchMsg';
    id: DocId;
    minimumClockSatisfied: boolean;
    patch: Patch;
    history: number;
}
export interface DocumentMsg {
    type: 'DocumentMessage';
    id: DocId;
    contents: any;
}
export interface MaterializeReplyMsg {
    type: 'MaterializeReplyMsg';
    patch: Patch;
}
export interface MetadataReplyMsg {
    type: 'MetadataReplyMsg';
    metadata: PublicMetadata | null;
}
export interface ActorIdMsg {
    type: 'ActorIdMsg';
    id: DocId;
    actorId: ActorId;
}
export interface CloseMsg {
    type: 'CloseMsg';
}
export interface ReadyMsg {
    type: 'ReadyMsg';
    id: DocId;
    minimumClockSatisfied: boolean;
    actorId?: ActorId;
    patch?: Patch;
    history?: number;
}
export interface ActorBlockDownloadedMsg {
    type: 'ActorBlockDownloadedMsg';
    id: DocId;
    actorId: ActorId;
    index: number;
    size: number;
    time: number;
}
export interface FileServerReadyMsg {
    type: 'FileServerReadyMsg';
    path: string;
}

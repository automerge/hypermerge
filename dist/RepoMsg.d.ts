import { Patch, Change } from 'automerge/frontend';
import { PublicMetadata } from './Metadata';
import { DocId, HyperfileId, ActorId } from './Misc';
export declare type ToBackendQueryMsg = MaterializeMsg | MetadataMsg;
export declare type ToFrontendReplyMsg = MaterializeReplyMsg | MetadataReplyMsg;
export declare type ToBackendRepoMsg = NeedsActorIdMsg | RequestMsg | CloseMsg | MergeMsg | CreateMsg | OpenMsg | DocumentMsg | DestroyMsg | DebugMsg | QueryMsg;
export interface QueryMsg {
    type: 'Query';
    id: number;
    query: ToBackendQueryMsg;
}
export interface ReplyMsg {
    type: 'Reply';
    id: number;
    payload: any;
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
export interface CreateMsg {
    type: 'CreateMsg';
    publicKey: string;
    secretKey: string;
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
export declare type ToFrontendRepoMsg = PatchMsg | ActorBlockDownloadedMsg | ActorIdMsg | ReadyMsg | ReadFileReply | ReplyMsg | DocumentMsg | FileServerReadyMsg;
export interface PatchMsg {
    type: 'PatchMsg';
    id: DocId;
    synced: boolean;
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
export interface ReadFileReply {
    type: 'ReadFileReply';
    id: HyperfileId;
    mimeType: string;
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
    synced: boolean;
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

import { Patch, Change } from "automerge";
import { PublicMetadata } from "./Metadata";
export declare type ToBackendQueryMsg = MaterializeMsg | MetadataMsg;
export declare type ToFrontendReplyMsg = MaterializeReplyMsg | MetadataReplyMsg;
export declare type ToBackendRepoMsg<T> = NeedsActorIdMsg | RequestMsg<T> | CloseMsg | MergeMsg | CreateMsg | OpenMsg | DestroyMsg | DebugMsg | WriteFile | ReadFile | QueryMsg | Uint8Array;
export interface QueryMsg {
    type: "Query";
    id: number;
    query: ToBackendQueryMsg;
}
export interface ReplyMsg {
    type: "Reply";
    id: number;
    payload: any;
}
export interface MaterializeMsg {
    type: "MaterializeMsg";
    id: string;
    history: number;
}
export interface MetadataMsg {
    type: "MetadataMsg";
    id: string;
}
export interface CreateMsg {
    type: "CreateMsg";
    publicKey: string;
    secretKey: string;
}
export interface WriteFile {
    type: "WriteFile";
    publicKey: string;
    secretKey: string;
    mimeType: string;
}
export interface ReadFile {
    type: "ReadFile";
    id: string;
}
export interface MergeMsg {
    type: "MergeMsg";
    id: string;
    actors: string[];
}
export interface DebugMsg {
    type: "DebugMsg";
    id: string;
}
export interface OpenMsg {
    type: "OpenMsg";
    id: string;
}
export interface DestroyMsg {
    type: "DestroyMsg";
    id: string;
}
export interface NeedsActorIdMsg {
    type: "NeedsActorIdMsg";
    id: string;
}
export interface RequestMsg<T> {
    type: "RequestMsg";
    id: string;
    request: Change<T>;
}
export declare type ToFrontendRepoMsg = PatchMsg | ActorBlockDownloadedMsg | ActorIdMsg | ReadyMsg | ReadFileReply | ReplyMsg | Uint8Array;
export interface PatchMsg {
    type: "PatchMsg";
    id: string;
    synced: boolean;
    patch: Patch;
    history: number;
}
export interface MaterializeReplyMsg {
    type: "MaterializeReplyMsg";
    patch: Patch;
}
export interface MetadataReplyMsg {
    type: "MetadataReplyMsg";
    metadata: PublicMetadata | null;
}
export interface ReadFileReply {
    type: "ReadFileReply";
    id: string;
    mimeType: string;
}
export interface ActorIdMsg {
    type: "ActorIdMsg";
    id: string;
    actorId: string;
}
export interface CloseMsg {
    type: "CloseMsg";
}
export interface ReadyMsg {
    type: "ReadyMsg";
    id: string;
    synced: boolean;
    actorId?: string;
    patch?: Patch;
    history?: number;
}
export interface ActorBlockDownloadedMsg {
    type: "ActorBlockDownloadedMsg";
    id: string;
    actorId: string;
    index: number;
    size: number;
    time: number;
}

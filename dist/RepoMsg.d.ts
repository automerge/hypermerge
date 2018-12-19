import { Patch, Change } from "automerge/frontend";
export declare type ToBackendRepoMsg = NeedsActorIdMsg | RequestMsg | FollowMsg | MergeMsg | CreateMsg | OpenMsg | DebugMsg | WriteFile | ReadFile | MaterializeMsg | Uint8Array;
export interface MaterializeMsg {
    type: "MaterializeMsg";
    id: string;
    history: number;
    msgid: number;
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
export interface FollowMsg {
    type: "FollowMsg";
    id: string;
    target: string;
}
export interface DebugMsg {
    type: "DebugMsg";
    id: string;
}
export interface OpenMsg {
    type: "OpenMsg";
    id: string;
}
export interface NeedsActorIdMsg {
    type: "NeedsActorIdMsg";
    id: string;
}
export interface RequestMsg {
    type: "RequestMsg";
    id: string;
    request: Change;
}
export declare type ToFrontendRepoMsg = PatchMsg | ActorBlockDownloadedMsg | ActorIdMsg | ReadyMsg | ReadFileReply | MaterializeReplyMsg | Uint8Array;
export interface PatchMsg {
    type: "PatchMsg";
    id: string;
    patch: Patch;
    history: number;
}
export interface MaterializeReplyMsg {
    type: "MaterializeReplyMsg";
    msgid: number;
    patch: Patch;
}
export interface ReadFileReply {
    type: "ReadFileReply";
    id: string;
}
export interface ActorIdMsg {
    type: "ActorIdMsg";
    id: string;
    actorId: string;
}
export interface ReadyMsg {
    type: "ReadyMsg";
    id: string;
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

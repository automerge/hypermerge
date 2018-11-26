import { Patch, Change } from "automerge/frontend";
export declare type ToBackendRepoMsg = NeedsActorIdMsg | RequestMsg | MergeMsg | CreateMsg | OpenMsg;
export interface CreateMsg {
    type: "CreateMsg";
    publicKey: string;
    secretKey: string;
}
export interface MergeMsg {
    type: "MergeMsg";
    id: string;
    actors: string[];
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
export declare type ToFrontendRepoMsg = PatchMsg | ActorIdMsg | ReadyMsg;
export interface PatchMsg {
    type: "PatchMsg";
    id: string;
    patch: Patch;
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
}

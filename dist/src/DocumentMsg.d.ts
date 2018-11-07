import { Patch, Change } from "automerge/frontend";
export declare type ToBackendMsg = NeedsActorIdMsg | RequestMsg;
export interface NeedsActorIdMsg {
    type: "NeedsActorIdMsg";
}
export interface RequestMsg {
    type: "RequestMsg";
    request: Change;
}
export declare type ToFrontendMsg = PatchMsg | ActorIdMsg | ReadyMsg;
export interface PatchMsg {
    type: "PatchMsg";
    patch: Patch;
}
export interface ActorIdMsg {
    type: "ActorIdMsg";
    actorId: string;
}
export interface ReadyMsg {
    type: "ReadyMsg";
    actorId?: string;
    patch?: Patch;
}

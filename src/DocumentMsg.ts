
import { Patch, Doc, Change, ChangeFn } from "automerge/frontend"

export type ToBackendMsg = NeedsActorIdMsg | RequestMsg

export interface NeedsActorIdMsg {
  type: "NeedsActorIdMsg"
}

export interface RequestMsg {
  type: "RequestMsg"
  request: Change
}

export type ToFrontendMsg = PatchMsg | ActorIdMsg | ReadyMsg


export interface PatchMsg {
  type: "PatchMsg"
  patch: Patch
}

export interface ActorIdMsg {
  type: "ActorIdMsg"
  actorId: string
}

export interface ReadyMsg {
  type: "ReadyMsg"
  actorId?: string
  patch?: Patch
}

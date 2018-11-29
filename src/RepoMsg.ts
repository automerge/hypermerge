
import { Clock, Patch, Doc, Change, ChangeFn } from "automerge/frontend"

export type ToBackendRepoMsg = NeedsActorIdMsg | RequestMsg | FollowMsg | MergeMsg | CreateMsg | OpenMsg
 
export interface CreateMsg {
  type: "CreateMsg"
  publicKey: string
  secretKey: string
}

export interface MergeMsg {
  type: "MergeMsg"
  id: string
  actors: string[]
}

export interface FollowMsg {
  type: "FollowMsg"
  id: string
  target: string
}

export interface OpenMsg {
  type: "OpenMsg"
  id: string
}

export interface NeedsActorIdMsg {
  type: "NeedsActorIdMsg"
  id: string
}

export interface RequestMsg {
  type: "RequestMsg"
  id: string
  request: Change
}

export type ToFrontendRepoMsg = PatchMsg | ActorIdMsg | ReadyMsg

export interface PatchMsg {
  type: "PatchMsg"
  id: string
  patch: Patch
}

export interface ActorIdMsg {
  type: "ActorIdMsg"
  id: string
  actorId: string
}

export interface ReadyMsg {
  type: "ReadyMsg"
  id: string
  actorId?: string
  patch?: Patch
}

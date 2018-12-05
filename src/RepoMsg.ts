
import { Clock, Patch, Doc, Change, ChangeFn } from "automerge/frontend"

export type ToBackendRepoMsg = NeedsActorIdMsg | RequestMsg | FollowMsg | MergeMsg | CreateMsg | OpenMsg | DebugMsg | WriteFile | ReadFile | Uint8Array
 
export interface CreateMsg {
  type: "CreateMsg"
  publicKey: string
  secretKey: string
}

export interface WriteFile {
  type: "WriteFile"
  publicKey: string
  secretKey: string
}

export interface ReadFile {
  type: "ReadFile"
  id: string
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

export interface DebugMsg {
  type: "DebugMsg"
  id: string
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

export type ToFrontendRepoMsg = PatchMsg | ActorIdMsg | ReadyMsg | ReadFileReply | Uint8Array

export interface PatchMsg {
  type: "PatchMsg"
  id: string
  patch: Patch
}

export interface ReadFileReply {
  type: "ReadFileReply"
  id: string
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

import { Patch, Change } from "automerge/frontend";
import { PublicMetadata } from "./Metadata"

export type ToBackendQueryMsg =
  | MaterializeMsg
  | MetadataMsg

export type ToFrontendReplyMsg =
  | MaterializeReplyMsg
  | MetadataReplyMsg

export type ToBackendRepoMsg =
  | NeedsActorIdMsg
  | RequestMsg
  | CloseMsg
  | MergeMsg
  | CreateMsg
  | OpenMsg
  | DestroyMsg
  | DebugMsg
  | WriteFile
  | ReadFile
  | QueryMsg
  | Uint8Array;

export interface QueryMsg {
  type: "Query";
  id: number;
  query: ToBackendQueryMsg;
}

export interface ReplyMsg {
  type: "Reply";
  id: number;
  payload: any // PublicMetadata | Patch
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

export interface RequestMsg {
  type: "RequestMsg";
  id: string;
  request: Change;
}

export type ToFrontendRepoMsg =
  | PatchMsg
  | ActorBlockDownloadedMsg
  | ActorIdMsg
  | ReadyMsg
  | ReadFileReply
  | ReplyMsg
  | Uint8Array;

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

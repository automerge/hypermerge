/// <reference types="node" />
import { Freeze } from 'automerge'
import { Readable } from 'stream'
import { FeedId } from './FeedStore'
export declare type BaseId = string &
  Freeze<{
    id: true
  }>
export declare type DocId = BaseId &
  Freeze<{
    docId: true
  }>
export declare type ActorId = FeedId &
  Freeze<{
    actorId: true
  }>
export declare type HyperfileId = BaseId &
  Freeze<{
    hyperfileId: true
  }>
export declare type DiscoveryId = BaseId &
  Freeze<{
    discoveryId: true
  }>
export declare type BaseUrl = string &
  Freeze<{
    url: true
  }>
export declare type DocUrl = BaseUrl &
  Freeze<{
    docUrl: true
  }>
export declare type HyperfileUrl = BaseUrl &
  Freeze<{
    hyperfileUrl: true
  }>
export declare function encodeDocId(actorKey: Buffer): DocId
export declare function encodeActorId(actorKey: Buffer): ActorId
export declare function encodeDiscoveryId(discoveryKey: Buffer): DiscoveryId
export declare function encodeHyperfileId(hyperfileKey: Buffer): HyperfileId
export declare function toDocUrl(docId: DocId): DocUrl
export declare function toHyperfileUrl(hyperfileId: HyperfileId): HyperfileUrl
export declare function rootActorId(docId: DocId): ActorId
export declare function hyperfileActorId(hyperfileId: HyperfileId): ActorId
export declare function isBaseUrl(str: BaseUrl | BaseId): str is BaseUrl
export declare function joinSets<T>(sets: Set<T>[]): Set<T>
export declare function ID(_id: string): string
export declare function notEmpty<TValue>(value: TValue | null | undefined): value is TValue
export declare function streamToBuffer(stream: Readable): Promise<Buffer>
export declare function bufferToStream(buffer: Buffer): Readable
export declare function toIpcPath(path: string): string

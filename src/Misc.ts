import * as Base58 from "bs58"

export type BaseId = string & { id: true }
export type DocId = BaseId & { docId: true }
export type ActorId = BaseId & { actorId: true }
export type HyperfileId = BaseId & { hyperfileId: true }
export type DiscoveryId = BaseId & { discoveryId: true }

export type BaseUrl = string & { url: true }
export type DocUrl = BaseUrl & { docUrl: true }
export type HyperfileUrl = BaseUrl & { hyperfileUrl: true }

export function encodeDocId(actorKey: Buffer): DocId {
  return Base58.encode(actorKey) as DocId
}

export function encodeActorId(actorKey: Buffer): ActorId {
  return Base58.encode(actorKey) as ActorId
}

export function encodeDiscoveryId(discoveryKey: Buffer): DiscoveryId {
  return Base58.encode(discoveryKey) as DiscoveryId
}

export function encodeHyperfileId(hyperfileKey: Buffer): HyperfileId {
  return Base58.encode(hyperfileKey) as HyperfileId
}

export function asDocUrl(docId: DocId): DocUrl {
  return `hypermerge:/${docId}` as DocUrl
}

export function rootActorId(docId: DocId): ActorId {
  return docId as string as ActorId
}

export function hyperfileActorId(hyperfileId: HyperfileId): ActorId {
  return hyperfileId as string as ActorId
}

export function isBaseUrl(str: BaseUrl | BaseId): str is BaseUrl {
  return str.includes(":")
}

export function joinSets<T>(sets: Set<T>[]): Set<T> {
  const total = ([] as T[]).concat(...sets.map(a => [...a]));
  return new Set(total);
}

export function ID(_id: string) : string {
  return _id.slice(0,4)
}

export function notEmpty<TValue>(
  value: TValue | null | undefined
): value is TValue {
  return value !== null && value !== undefined;
}

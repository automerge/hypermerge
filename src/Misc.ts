import { FeedId } from './FeedStore'
import * as Keys from './Keys'
import { Key, PublicKey, DiscoveryKey, DiscoveryId, PublicId, EncodedKeyId } from './Keys'

export { DiscoveryId }
export type RepoId = PublicId & { __repoId: true }
export type DocId = PublicId & { __docId: true }
export type ActorId = FeedId & { __actorId: true }
export type HyperfileId = FeedId & { __hyperfileId: true }

export type BaseUrl = string & { __baseUrl: true }
export type DocUrl = BaseUrl & { __docUrl: true }
export type HyperfileUrl = BaseUrl & { __hyperfileUrl: true }

export function decodeId(id: EncodedKeyId): Key {
  return Keys.decode(id)
}

export function encodeRepoId(repoKey: PublicKey): RepoId {
  return Keys.encode(repoKey) as RepoId
}

export function encodeDocId(actorKey: PublicKey): DocId {
  return Keys.encode(actorKey) as DocId
}

export function encodeActorId(actorKey: PublicKey): ActorId {
  return Keys.encode(actorKey) as ActorId
}

export function encodeHyperfileId(hyperfileKey: PublicKey): HyperfileId {
  return Keys.encode(hyperfileKey) as HyperfileId
}

export function toDocUrl(docId: DocId): DocUrl {
  return `hypermerge:/${docId}` as DocUrl
}

export function toHyperfileUrl(hyperfileId: HyperfileId): HyperfileUrl {
  return `hyperfile:/${hyperfileId}` as HyperfileUrl
}

export function toDiscoveryId(id: PublicId): DiscoveryId {
  return Keys.encode(toDiscoveryKey(id))
}

export function toDiscoveryKey(id: PublicId): DiscoveryKey {
  return Keys.discoveryKey(Keys.decode(id))
}

export function rootActorId(docId: DocId): ActorId {
  return (docId as string) as ActorId
}

export function hyperfileActorId(hyperfileId: HyperfileId): ActorId {
  return (hyperfileId as string) as ActorId
}

export function isBaseUrl(str: BaseUrl | EncodedKeyId): str is BaseUrl {
  return str.includes(':')
}

export function joinSets<T>(sets: Set<T>[]): Set<T> {
  const total = ([] as T[]).concat(...sets.map((a) => [...a]))
  return new Set(total)
}

export function ID(_id: string): string {
  return _id.slice(0, 4)
}

export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined
}

export function getOrCreate<K extends Object, V>(
  map: WeakMap<K, V>,
  key: K,
  create: (key: K) => V
): V
export function getOrCreate<K, V>(map: Map<K, V>, key: K, create: (key: K) => V): V
export function getOrCreate<K, V>(
  map: Map<K, V> | WeakMap<K & Object, V>,
  key: K,
  create: (key: K) => V
): V {
  const existing = map.get(key)
  if (existing) return existing

  const created = create(key)
  map.set(key, created)
  return created
}

/**
 * The returned promise resolves after the `resolver` fn is called `n` times.
 * Promises the last value passed to the resolver.
 */
export function createMultiPromise<T>(
  n: number,
  factory: (resolver: (value: T) => void, rejector: (err: Error) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const res = (value: T) => {
      n -= 1
      if (n === 0) resolve(value)
    }

    const rej = (err: Error) => {
      n = -1 // Ensure we never resolve
      reject(err)
    }

    factory(res, rej)
  })
}

// Windows uses named pipes:
// https://nodejs.org/api/net.html#net_identifying_paths_for_ipc_connections
export function toIpcPath(path: string): string {
  return process.platform === 'win32' ? toWindowsNamedPipe(path) : path
}

// Inspired by node-ipc
// https://github.com/RIAEvangelist/node-ipc/blob/70e03c119b4902d3e74de1f683ab39dd2f634807/dao/socketServer.js#L309
function toWindowsNamedPipe(path: string): string {
  const sanitizedPath = path.replace(/^\//, '').replace(/\//g, '-')
  return `\\\\.\\pipe\\${sanitizedPath}`
}

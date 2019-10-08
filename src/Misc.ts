import * as Base58 from 'bs58'
import { Readable } from 'stream'
import { FeedId } from './FeedStore'
import { discoveryKey } from './hypercore'

export type BaseId = string & { id: true }
export type RepoId = BaseId & { repoId: true }
export type DocId = BaseId & { docId: true }
export type ActorId = FeedId & { actorId: true }
export type HyperfileId = BaseId & { hyperfileId: true }
export type DiscoveryId = BaseId & { discoveryId: true }

export type BaseUrl = string & { url: true }
export type DocUrl = BaseUrl & { docUrl: true }
export type HyperfileUrl = BaseUrl & { hyperfileUrl: true }

export function encodeRepoId(repoKey: Buffer): RepoId {
  return Base58.encode(repoKey) as RepoId
}

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

export function toDocUrl(docId: DocId): DocUrl {
  return `hypermerge:/${docId}` as DocUrl
}

export function toHyperfileUrl(hyperfileId: HyperfileId): HyperfileUrl {
  return `hyperfile:/${hyperfileId}` as HyperfileUrl
}

export function decodeId(id: BaseId): Buffer {
  return Base58.decode(id)
}

export function toDiscoveryId(id: BaseId): DiscoveryId {
  return Base58.encode(toDiscoveryKey(id)) as DiscoveryId
}

export function toDiscoveryKey(id: BaseId): Buffer {
  return discoveryKey(Base58.decode(id))
}

export function rootActorId(docId: DocId): ActorId {
  return (docId as string) as ActorId
}

export function hyperfileActorId(hyperfileId: HyperfileId): ActorId {
  return (hyperfileId as string) as ActorId
}

export function isBaseUrl(str: BaseUrl | BaseId): str is BaseUrl {
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

export function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((res, rej) => {
    const buffers: Buffer[] = []
    stream
      .on('data', (data: Buffer) => buffers.push(data))
      .on('error', (err: any) => rej(err))
      .on('end', () => res(Buffer.concat(buffers)))
  })
}

export function bufferToStream(buffer: Buffer): Readable {
  return new Readable({
    read() {
      this.push(buffer)
      this.push(null)
    },
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

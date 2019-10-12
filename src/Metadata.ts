import Queue from './Queue'
import MapSet from './MapSet'
import * as Base58 from 'bs58'
import hypercore, { Feed } from 'hypercore'
import { readFeed } from './hypercore'
import Debug from 'debug'
import * as JsonBuffer from './JsonBuffer'
import * as URL from 'url'
import { hyperfileActorId } from './Misc'
const log = Debug('repo:metadata')

import { Clock, equivalent, addTo, union } from './Clock'
import {
  DocUrl,
  DocId,
  ActorId,
  BaseUrl,
  BaseId,
  isBaseUrl,
  HyperfileId,
  HyperfileUrl,
} from './Misc'

export function sanitizeRemoteMetadata(message: any): RemoteMetadata {
  const result: RemoteMetadata = { type: 'RemoteMetadata', clocks: {}, blocks: [] }

  if (
    message instanceof Object &&
    Array.isArray(message.blocks) &&
    message.clocks instanceof Object
  ) {
    result.blocks = filterMetadataInputs(message.blocks)
    result.clocks = message.clocks
    return result
  } else {
    console.log('WARNING: Metadata Msg is not a well formed object', message)
    return result
  }
}

export function cleanMetadataInput(input: any): MetadataBlock | undefined {
  const id = input.id || input.docId
  if (typeof id !== 'string') return undefined

  const bytes = input.bytes
  if (typeof bytes !== 'undefined' && typeof bytes !== 'number') return undefined

  const actors = input.actors || input.actorIds
  //  const follows = input.follows;
  const merge = input.merge
  const mimeType = input.mimeType
  const deleted = input.deleted

  if (actors !== undefined) {
    if (!(actors instanceof Array)) return undefined
    if (!actors.every(isValidID)) return undefined
  }

  //  if (follows !== undefined) {
  //    if (!(follows instanceof Array)) return undefined;
  //    if (!follows.every(isValidID)) return undefined;
  //  }

  if (merge !== undefined) {
    if (typeof merge !== 'object') return undefined
    if (!Object.keys(merge).every((id) => isValidID(id as ActorId))) return undefined
    if (!Object.values(merge).every(isNumber)) return undefined
  }

  const meta = actors || deleted || merge // || follows;

  if (meta === undefined && bytes === undefined) return undefined

  if (meta !== undefined && bytes !== undefined) return undefined

  // XXX(jeff): This is not technically returning a valid MetadataBlock. It's
  // returning a union of all possible sub-types, which is a valid type, but not
  // a valid value.
  return {
    id,
    bytes,
    mimeType,
    actors,
    //    follows,
    merge,
    deleted,
  } as any
}

export function filterMetadataInputs(input: any[]): MetadataBlock[] {
  const metadata: MetadataBlock[] = []
  input.forEach((i) => {
    const cleaned = cleanMetadataInput(i)
    if (cleaned) {
      metadata.push(cleaned)
    } else {
      log('WARNING: Metadata Input Invalid - ignoring', i)
    }
  })
  return metadata
}

export interface UrlInfo {
  id: BaseId
  buffer: Buffer
  type: string
}

interface ActorsBlock {
  id: DocId
  actors: ActorId[]
}

interface MergeBlock {
  id: DocId
  merge: Clock
}

interface DeletedBlock {
  id: DocId
  deleted: true
}

interface FileBlock {
  id: HyperfileId
  bytes: number
  mimeType: string
}

export type MetadataBlock = FileBlock | ActorsBlock | MergeBlock | DeletedBlock

function isFileBlock(block: MetadataBlock): block is FileBlock {
  return 'mimeType' in block && typeof block.mimeType === 'string' && block.bytes != undefined
}

function isDeletedBlock(block: MetadataBlock): block is DeletedBlock {
  return 'deleted' in block && block.deleted
}

function isNumber(n: any): n is number {
  return typeof n === 'number'
}

// are try catchs as expensive as I remember?  Not sure - I wrote this logic twice
export function isValidID(id: BaseId): id is BaseId {
  try {
    const buffer = Base58.decode(id)
    return buffer.length === 32
  } catch (e) {
    return false
  }
}

function validateID(id: BaseId): Buffer {
  log(`id '${id}'`)
  const buffer = Base58.decode(id)
  if (buffer.length !== 32) {
    throw new Error(`invalid id ${id}`)
  }
  return buffer
}

export function validateURL(urlString: BaseUrl | BaseId): UrlInfo {
  if (!isBaseUrl(urlString)) {
    //    disabled this warning because internal APIs are currently inconsistent in their use
    //    so it's throwing warnings just, like, all the time in normal usage.
    //    console.log("WARNING: `${id}` is deprecated - now use `hypermerge:/${id}`")
    //    throw new Error("WARNING: open(id) is depricated - now use open(`hypermerge:/${id}`)")
    const id = urlString
    const buffer = validateID(id)
    return { type: 'hypermerge', buffer, id }
  }

  const url = URL.parse(urlString)
  if (!url.path || !url.protocol) {
    throw new Error('invalid URL: ' + urlString)
  }
  const id = url.path.slice(1) as DocId
  const type = url.protocol.slice(0, -1)
  const buffer = validateID(id)
  if (type !== 'hypermerge' && type != 'hyperfile') {
    throw new Error(`protocol must be hypermerge or hyperfile (${type}) (${urlString})`)
  }
  return { id, buffer, type }
}

export function validateFileURL(urlString: HyperfileUrl | HyperfileId): HyperfileId {
  const info = validateURL(urlString)
  if (info.type != 'hyperfile') {
    throw new Error('invalid URL - protocol must be hyperfile')
  }
  return info.id as HyperfileId
}

export function validateDocURL(urlString: DocUrl | DocId): DocId {
  const info = validateURL(urlString)
  if (info.type != 'hypermerge') {
    throw new Error('invalid URL - protocol must be hypermerge')
  }
  return info.id as DocId
}

var _benchTotal: { [type: string]: number } = {}

export interface RemoteMetadata {
  type: 'RemoteMetadata'
  clocks: { [docId: string]: Clock }
  blocks: MetadataBlock[]
}

export class Metadata {
  docs: Set<DocId> = new Set()
  private primaryActors: MapSet<DocId, ActorId> = new MapSet()
  //  private follows: MapSet<string, string> = new MapSet();
  private files: Map<HyperfileId, number> = new Map()
  private mimeTypes: Map<HyperfileId, string> = new Map()
  private merges: Map<DocId, Clock> = new Map()
  readyQ: Queue<() => void> = new Queue('repo:metadata:readyQ') // FIXME - need a better api for accessing metadata
  private _clocks: { [docId: string /* DocId */]: Clock } = {}
  private _docsWith: Map<string /* ${actor}-${seq} */, DocId[]> = new Map()

  private writable: Map<ActorId, boolean> = new Map()

  // whats up with this ready/replay thing
  // there is a situation where someone opens a new document before the ledger is done readying
  // one option would be to make every single function in hypermerge async or run with a promise
  // this complexity here allows the whole library to remain syncronous
  // writes to metadata before the ledger is done being read is saved temporaily and then
  // erased and replayed when the load is complete
  // this lets us know if the edits change the state of the metadata and need to be written
  // to the ledger
  // ( an alternate (but bad) fix would be to write to the ledger always in these cases
  // but this would cause the ledger to have potientially massive amounts of redundant data in it

  private ready: boolean = false
  private replay: MetadataBlock[] = []

  private ledger: Feed<Uint8Array>
  private join: (id: ActorId) => void
  private leave: (id: ActorId) => void

  constructor(storageFn: Function, joinFn: (id: ActorId) => void, leaveFn: (id: ActorId) => void) {
    this.ledger = hypercore(storageFn('ledger'), {})
    this.join = joinFn
    this.leave = leaveFn

    log('LEDGER READY (1)')
    this.ledger.ready(() => {
      log('LEDGER READY (2)', this.ledger.length)
      readFeed('ledger', this.ledger, this.loadLedger)
    })
  }

  private loadLedger = (buffers: Uint8Array[]) => {
    const input = JsonBuffer.parseAllValid(buffers)
    const data = filterMetadataInputs(input) // FIXME
    this.primaryActors = new MapSet()
    //    this.follows = new MapSet();
    this.files = new Map()
    this.mimeTypes = new Map()
    this.merges = new Map()
    this.ready = true
    this.batchAdd(data)
    this.replay.map(this.writeThrough)
    this.replay = []
    this._clocks = {}
    this._docsWith = new Map()
    this.allActors().forEach((actorId: string) => this.join(actorId as ActorId))
    this.readyQ.subscribe((f) => f())
  }

  private batchAdd(blocks: MetadataBlock[]) {
    log('Batch add', blocks.length)
    blocks.forEach((block, i) => this.addBlock(i, block))
  }

  // write through caching strategy
  private writeThrough = (block: MetadataBlock) => {
    log('writeThrough', block)
    if (!this.ready) this.replay.push(block)

    const dirty = this.addBlock(-1, block)

    if (this.ready && dirty) {
      this.append(block)
      this._clocks = {}
      this._docsWith.clear()

      if (isFileBlock(block)) {
        this.join(hyperfileActorId(block.id))
      } else if (isDeletedBlock(block)) {
        this.actors(block.id).forEach(this.leave)
      } else {
        this.actors(block.id).forEach(this.join)
      }
    }
  }

  private append = (block: MetadataBlock) => {
    this.ledger.append(JsonBuffer.bufferify(block), (err) => {
      if (err) console.log('APPEND ERROR', err)
    })
  }

  private addBlock(_idx: number, block: MetadataBlock): boolean {
    let changedDocs = false
    let changedActors = false
    //    let changedFollow = false;
    let changedFiles = false
    let changedMerge = false

    if ('actors' in block && block.actors !== undefined) {
      changedActors = this.primaryActors.merge(block.id, block.actors)
    }

    //    if (block.follows !== undefined) {
    //      changedFollow = this.follows.merge(id, block.follows);
    //    }

    if (isFileBlock(block)) {
      if (
        this.files.get(block.id) !== block.bytes ||
        this.mimeTypes.get(block.id) !== block.mimeType
      ) {
        changedFiles = true
        this.files.set(block.id, block.bytes)
        this.mimeTypes.set(block.id, block.mimeType)
      }
    }

    if ('merge' in block && block.merge !== undefined) {
      const oldClock: Clock = this.merges.get(block.id) || {}
      const newClock = union(oldClock, block.merge)
      changedMerge = !equivalent(newClock, oldClock)
      if (changedMerge) {
        this.merges.set(block.id, newClock)
      }
    }

    // shit - bug - rethink the whole remote people deleted something
    // i dont care of they deleted it
    if ('deleted' in block && block.deleted) {
      if (this.docs.has(block.id)) {
        this.docs.delete(block.id)
        changedDocs = true
      }
    } else {
      // XXX(jeff): I don't think this logic can be correct. This branch will be run
      // for FileBlocks. That seems bad, but I'm not sure how to fix it.

      const brokenId = block.id as DocId // HACK: This type not matching is part of why I think it's incorrect
      if (!this.docs.has(brokenId)) {
        this.docs.add(brokenId)
        changedDocs = true
      }
    }

    return changedActors || changedMerge || changedFiles || changedDocs // || changedFollow;
  }

  allActors(): Set<string> {
    return new Set([...this.primaryActors.union(), ...this.files.keys()])
  }

  setWritable(actor: ActorId, writable: boolean) {
    this.writable.set(actor, writable)
  }

  localActorId(id: DocId): ActorId | undefined {
    for (let actor of this.primaryActors.get(id)!) {
      if (this.writable.get(actor) === true) {
        return actor
      }
    }
    return undefined
  }

  async actorsAsync(id: DocId): Promise<ActorId[]> {
    return new Promise<ActorId[]>((resolve) => {
      this.readyQ.push(() => {
        resolve(this.actors(id))
      })
    })
  }

  actors(id: DocId): ActorId[] {
    return Object.keys(this.clock(id)) as ActorId[]
  }

  /*
  private actorsSeen(id: string, acc: string[], seen: Set<string>): string[] {
    const primaryActors = this.primaryActors.get(id)!;
    const mergeActors = Object.keys(this.merges.get(id) || {});
    acc.push(...primaryActors);
    acc.push(...mergeActors);
    seen.add(id);
    this.follows.get(id).forEach(follow => {
      if (!seen.has(follow)) {
        this.actorsSeen(follow, acc, seen);
      }
    });
    return acc;
  }
*/

  clockAt(id: DocId, actor: ActorId): number {
    return this.clock(id)[actor] || 0
  }

  clock(id: DocId): Clock {
    if (this._clocks[id]) return this._clocks[id]

    const clock: Clock = { [id]: Infinity } // this also covers the clock for files
    const actors = this.primaryActors.get(id)
    const merges = this.merges.get(id)

    if (actors) actors.forEach((actor) => (clock[actor] = Infinity))

    if (merges) addTo(clock, merges)

    this._clocks[id] = clock

    return clock
  }

  docsWith(actor: ActorId, seq: number = 1): DocId[] {
    // this is probably unnecessary
    const key = `${actor}-${seq}`
    if (!this._docsWith.has(key)) {
      const docs = [...this.docs].filter((id) => this.has(id, actor, seq))
      this._docsWith.set(key, docs)
    }
    return this._docsWith.get(key)!
  }

  has(id: DocId, actor: ActorId, seq: number): boolean {
    if (!(seq >= 1)) throw new Error('seq number must be 1 or greater')

    return this.clockAt(id, actor) >= seq
  }

  merge(id: DocId, merge: Clock) {
    this.writeThrough({ id, merge })
  }

  addFile(hyperfileUrl: HyperfileUrl, bytes: number, mimeType: string) {
    const id = validateFileURL(hyperfileUrl)
    this.writeThrough({ id, bytes, mimeType })
  }

  delete(id: DocId) {
    this.writeThrough({ id, deleted: true })
  }

  addActor(id: DocId, actorId: ActorId) {
    this.addActors(id, [actorId])
  }

  addBlocks(blocks: MetadataBlock[]) {
    blocks.forEach((block) => {
      this.writeThrough(block)
    })
  }

  addActors(id: DocId, actors: ActorId[]) {
    this.writeThrough({ id, actors })
  }

  isFile(id: HyperfileId | DocId): id is HyperfileId {
    return this.files.get(id as HyperfileId) !== undefined
  }

  isKnown(id: DocId | HyperfileId): boolean {
    return this.isFile(id) || this.isDoc(id)
  }

  isDoc(id: DocId | HyperfileId): id is DocId {
    return this.primaryActors.get(id as DocId).size > 0
  }

  bench(msg: string, f: () => void): void {
    const start = Date.now()
    f()
    const duration = Date.now() - start
    const total = (_benchTotal[msg] || 0) + duration
    _benchTotal[msg] = total
    log(`metadata task=${msg} time=${duration}ms total=${total}ms`)
  }

  publicMetadata(id: DocId | HyperfileId, cb: (meta: PublicMetadata | null) => void) {
    this.readyQ.push(() => {
      if (this.isDoc(id)) {
        cb({
          type: 'Document',
          clock: {},
          history: 0,
          actor: this.localActorId(id), // FIXME - why is this undefined??
          actors: this.actors(id),
          //          follows: [...this.follows.get(id)]
        })
      } else if (this.isFile(id)) {
        const bytes = this.files.get(id)!
        const mimeType = this.mimeTypes.get(id)!
        cb({
          type: 'File',
          bytes,
          mimeType,
        })
      } else {
        cb(null)
      }
    })
  }

  forDoc(id: DocId): ActorsBlock & MergeBlock {
    return {
      id,
      actors: [...this.primaryActors.get(id)],
      //      follows: [...this.follows.get(id)],
      merge: this.merges.get(id) || {},
    }
  }

  forActor(actor: ActorId): MetadataBlock[] {
    return this.docsWith(actor).map((id) => this.forDoc(id))
  }
}

export type PublicMetadata = PublicDocMetadata | PublicFileMetadata

export type PublicDocMetadata = {
  type: 'Document'
  clock: Clock
  history: number
  actor: ActorId | undefined
  actors: ActorId[]
  //  follows: string[];
}

export type PublicFileMetadata = {
  type: 'File'
  bytes: number
  mimeType: string
}

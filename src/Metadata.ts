import Queue from './Queue'
import * as Base58 from 'bs58'
import hypercore, { Feed } from 'hypercore'
import { readFeed } from './hypercore'
import Debug from 'debug'
import * as JsonBuffer from './JsonBuffer'
import * as URL from 'url'
const log = Debug('repo:metadata')

import { Clock } from './Clock'
import { DocUrl, DocId, ActorId, BaseUrl, isBaseUrl, HyperfileId, HyperfileUrl } from './Misc'
import * as Keys from './Keys'

export function cleanMetadataInput(input: any): MetadataBlock | undefined {
  const id = input.id || input.docId
  if (typeof id !== 'string') return undefined

  const bytes = input.bytes
  if (typeof bytes !== 'undefined' && typeof bytes !== 'number') return undefined

  const mimeType = input.mimeType

  if (bytes === undefined) return undefined

  return {
    id,
    bytes,
    mimeType,
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
  id: Keys.PublicId
  buffer: Buffer
  type: string
}

interface FileBlock {
  id: HyperfileId
  bytes: number
  mimeType: string
}

export type MetadataBlock = FileBlock

function isFileBlock(block: MetadataBlock): block is FileBlock {
  return 'mimeType' in block && typeof block.mimeType === 'string' && block.bytes != undefined
}

// are try catchs as expensive as I remember?  Not sure - I wrote this logic twice
export function isValidID(id: Keys.PublicId): id is Keys.PublicId {
  try {
    const buffer = Base58.decode(id)
    return buffer.length === 32
  } catch (e) {
    return false
  }
}

function validateID(id: Keys.PublicId): Keys.PublicKey {
  log(`id '${id}'`)
  const buffer = Keys.decode(id)
  if (buffer.length !== 32) {
    throw new Error(`invalid id ${id}`)
  }
  return buffer
}

export function validateURL(urlString: BaseUrl | Keys.PublicId): UrlInfo {
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

export class Metadata {
  private files: Map<HyperfileId, number> = new Map()
  private mimeTypes: Map<HyperfileId, string> = new Map()
  readyQ: Queue<() => void> = new Queue('repo:metadata:readyQ') // FIXME - need a better api for accessing metadata

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

  constructor(storageFn: Function) {
    this.ledger = hypercore(storageFn('ledger'), {})

    log('LEDGER READY (1)')
    this.ledger.ready(() => {
      log('LEDGER READY (2)', this.ledger.length)
      readFeed('ledger', this.ledger, this.loadLedger)
    })
  }

  private loadLedger = (buffers: Uint8Array[]) => {
    const input = JsonBuffer.parseAllValid(buffers)
    const data = filterMetadataInputs(input) // FIXME
    this.files = new Map()
    this.mimeTypes = new Map()
    this.ready = true
    this.batchAdd(data)
    this.replay.map(this.writeThrough)
    this.replay = []
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
    }
  }

  private append = (block: MetadataBlock) => {
    this.ledger.append(JsonBuffer.bufferify(block), (err) => {
      if (err) console.log('APPEND ERROR', err)
    })
  }

  private addBlock(_idx: number, block: MetadataBlock): boolean {
    let changedFiles = false

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

    return changedFiles
  }

  isWritable(actorId: ActorId) {
    return this.writable.get(actorId) || false
  }

  setWritable(actor: ActorId, writable: boolean) {
    this.writable.set(actor, writable)
  }

  addFile(hyperfileUrl: HyperfileUrl, bytes: number, mimeType: string) {
    const id = validateFileURL(hyperfileUrl)
    this.writeThrough({ id, bytes, mimeType })
  }

  addBlocks(blocks: MetadataBlock[]) {
    blocks.forEach((block) => {
      this.writeThrough(block)
    })
  }

  isFile(id: HyperfileId | DocId): id is HyperfileId {
    return this.files.get(id as HyperfileId) !== undefined
  }

  isDoc(id: DocId | HyperfileId): id is DocId {
    return !this.isFile(id)
  }

  bench(msg: string, f: () => void): void {
    const start = Date.now()
    f()
    const duration = Date.now() - start
    const total = (_benchTotal[msg] || 0) + duration
    _benchTotal[msg] = total
    log(`metadata task=${msg} time=${duration}ms total=${total}ms`)
  }

  fileMetadata(id: HyperfileId): PublicFileMetadata {
    const bytes = this.files.get(id)!
    const mimeType = this.mimeTypes.get(id)!
    return {
      type: 'File',
      bytes,
      mimeType,
    }
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

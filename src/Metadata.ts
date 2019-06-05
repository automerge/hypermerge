import Queue from "./Queue";
import MapSet from "./MapSet";
import * as Base58 from "bs58";
import { hypercore, readFeed, Feed } from "./hypercore";
import Debug from "debug";
import * as JsonBuffer from "./JsonBuffer"
import * as URL from "url"
const log = Debug("repo:metadata");

import { Clock, equivalent, addTo, union, intersection } from "./Clock";

export interface NewMetadata {
  type: "NewMetadata"
  input: Uint8Array
}

export function validateRemoteMetadata(message: RemoteMetadata): RemoteMetadata {
  const result : RemoteMetadata = { type: "RemoteMetadata", clocks: {}, blocks: [] }
  if (message instanceof Object && message.blocks instanceof Array && message.clocks instanceof Object) {
    result.blocks = filterMetadataInputs(message.blocks);
    result.clocks = message.clocks
    return result
  } else {
    console.log("WARNING: Metadata Msg is not a well formed object", message);
    return result;
  }
}

export function cleanMetadataInput(input: any): MetadataBlock | undefined {
  const id = input.id || input.docId;
  if (typeof id !== "string") return undefined;

  const bytes = input.bytes;
  if (typeof bytes !== "undefined" && typeof bytes !== "number")
    return undefined;

  const actors = input.actors || input.actorIds;
//  const follows = input.follows;
  const merge = input.merge;
  const mimeType = input.mimeType
  const deleted = input.deleted

  if (actors !== undefined) {
    if (!(actors instanceof Array)) return undefined;
    if (!actors.every(isValidID)) return undefined;
  }

//  if (follows !== undefined) {
//    if (!(follows instanceof Array)) return undefined;
//    if (!follows.every(isValidID)) return undefined;
//  }

  if (merge !== undefined) {
    if (typeof merge !== "object") return undefined;
    if (!Object.keys(merge).every(isValidID)) return undefined;
    if (!Object.values(merge).every(isNumber)) return undefined;
  }

  const meta = actors || deleted || merge // || follows;

  if (meta === undefined && bytes === undefined) return undefined;

  if (meta !== undefined && bytes !== undefined) return undefined;

  return {
    id,
    bytes,
    mimeType,
    actors,
//    follows,
    merge,
    deleted
  };
}

export function filterMetadataInputs(input: any[]): MetadataBlock[] {
  const metadata: MetadataBlock[] = [];
  input.forEach(i => {
    const cleaned = cleanMetadataInput(i);
    if (cleaned) {
      metadata.push(cleaned);
    } else {
      log("WARNING: Metadata Input Invalid - ignoring", i);
    }
  });
  return metadata;
}

export interface UrlInfo {
  id: string
  buffer: Buffer
  type: string
}

// this really should be FileMetadata | DocMetadata - cant easily add a type field
// b/c of backward compat
export interface MetadataBlock {
  id: string;
  bytes?: number;
  mimeType?: string;
  actors?: string[];
//  follows?: string[];
  merge?: Clock;
  deleted?: boolean;
}

// Can I use stuff like this to let ID's be a type other than string?
//   export function isActorId(id: string) id is ActorId { }
//   export type ActorId = string & { _: "ActorId" }
//   export type DocId = string & { _: "ActorId", _2: "DocId" }

// are try catchs as expensive as I remember?  Not sure - I wrote this logic twice
function isNumber(n: any): boolean {
  return typeof n === "number";
}
export function isValidID(id: any): boolean {
  try {
    const buffer = Base58.decode(id);
    return buffer.length === 32;
  } catch (e) {
    return false;
  }
}

function validateID(id: string) : Buffer {
  log(`id '${id}'`)
  const buffer = Base58.decode(id);
  if (buffer.length !== 32) {
    throw new Error(`invalid id ${id}`);
  }
  return buffer
}

export function validateURL(urlString: string) : UrlInfo {
  if (urlString.indexOf(":") === -1) {
    console.log("WARNING: `${id}` is depricated - now use `hypermerge:/${id}`")
//    throw new Error("WARNING: open(id) is depricated - now use open(`hypermerge:/${id}`)")
    const id = urlString
    const buffer = validateID(id)
    return { type: "hypermerge", buffer, id }
  }
  const url = URL.parse(urlString)
  if (!url.path || !url.protocol) {
    throw new Error("invalid URL: " + urlString)
  }
  const id = url.path.slice(1)
  const type = url.protocol.slice(0,-1)
  const buffer = validateID(id)
  if (type !== "hypermerge" && type != "hyperfile") {
    throw new Error(`protocol must be hypermerge or hyperfile (${type}) (${urlString})`)
  }
  return { id, buffer, type }
}

export function validateFileURL(urlString: string) : string {
  const info = validateURL(urlString)
  if (info.type != "hyperfile") {
    throw new Error("invalid URL - protocol must be hyperfile")
  }
  return info.id
}

export function validateDocURL(urlString: string) : string {
  const info = validateURL(urlString)
  if (info.type != "hypermerge") {
    throw new Error("invalid URL - protocol must be hypermerge")
  }
  return info.id
}

var _benchTotal : { [type:string]:number } =  {}

export interface RemoteMetadata {
  type: "RemoteMetadata";
  clocks: { [id:string] : Clock };
  blocks: MetadataBlock[];
}

export class Metadata {
  docs: Set<string> = new Set();
  private primaryActors: MapSet<string, string> = new MapSet();
//  private follows: MapSet<string, string> = new MapSet();
  private files: Map<string, number> = new Map();
  private mimeTypes: Map<string, string> = new Map();
  private merges: Map<string, Clock> = new Map();
  readyQ: Queue<() => void> = new Queue(); // FIXME - need a better api for accessing metadata
  private _clocks: { [id:string]: Clock } = {}
  private _docsWith: Map<string, string[]> = new Map()

  private writable: Map<string, boolean> = new Map();


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

  private ready: boolean = false;
  private replay: MetadataBlock[] = [];

  private ledger: Feed<Uint8Array>;
  public id: Buffer // for the RepoBackend... used in examples (unwisely!) as a Peer ID
  private join: (id:string) => void;
  private leave: (id:string) => void;

  constructor(storageFn: Function, joinFn: (id:string) => void, leaveFn: (id:string) => void) {
    this.ledger = hypercore(storageFn("ledger"), {});
    this.join = joinFn
    this.leave = leaveFn
    this.id = this.ledger.id
    log("LEDGER READY (1)")
    this.ledger.ready(() => {
      log("LEDGER READY (2)",this.ledger.length)
      readFeed("ledger", this.ledger, this.loadLedger);
    });
  }

  private loadLedger = (buffers: Uint8Array[]) => {
    const input = JsonBuffer.parseAllValid(buffers)
    const data = filterMetadataInputs(input); // FIXME
    this.primaryActors = new MapSet();
//    this.follows = new MapSet();
    this.files = new Map();
    this.mimeTypes = new Map();
    this.merges = new Map();
    this.ready = true;
    this.batchAdd(data);
    this.replay.map(this.writeThrough);
    this.replay = [];
    this._clocks = {}
    this._docsWith = new Map()
    this.readyQ.subscribe(f => f());
  };

  private hasBlock(block: MetadataBlock): boolean {
    return false;
  }

  private batchAdd(blocks: MetadataBlock[]) {
    log("Batch add", blocks.length)
    blocks.forEach( (block,i) => this.addBlock(i, block));
  }

  // write through caching strategy
  private writeThrough = (block: MetadataBlock) => {
    log("writeThrough", block)
    if (!this.ready) this.replay.push(block);

    const dirty = this.addBlock(-1, block);

    if (this.ready && dirty) {
      this.append(block);
      this._clocks = {}
      this._docsWith.clear()
    }
  };

  private append = (block: MetadataBlock) => {
    this.ledger.append(JsonBuffer.bufferify(block), (err) => {
      if (err) console.log("APPEND ERROR",err)
    });
  }

  private addBlock(idx: number, block: MetadataBlock): boolean {
    let changedDocs = false;
    let changedActors = false;
//    let changedFollow = false;
    let changedFiles = false;
    let changedMerge = false;
    let id = block.id;

    if (block.actors !== undefined) {
      changedActors = this.primaryActors.merge(id, block.actors);
    }

//    if (block.follows !== undefined) {
//      changedFollow = this.follows.merge(id, block.follows);
//    }

    if (block.bytes !== undefined && block.mimeType !== undefined) {
      if (this.files.get(id) !== block.bytes || this.mimeTypes.get(id) !== block.mimeType) {
        changedFiles = true;
        this.files.set(id, block.bytes)
        this.mimeTypes.set(id, block.mimeType)
      }
    }

    if (block.merge !== undefined) {
      const oldClock: Clock = this.merges.get(id) || {};
      const newClock = union(oldClock, block.merge);
      changedMerge = !equivalent(newClock, oldClock);
      if (changedMerge) {
        this.merges.set(id, newClock);
      }
    }

    // shit - bug - rethink the whole remote people deleted something
    // i dont care of they deleted it
    if (block.deleted === true) {
      if (this.docs.has(id)) {
        this.docs.delete(id)
        changedDocs = true
      }
    } else {
      if (!this.docs.has(id)) {
        this.docs.add(id)
        changedDocs = true
      }
    }

    return changedActors || changedMerge || changedFiles || changedDocs // || changedFollow;
  }

  allActors() : Set<string> {
    return new Set([ ... this.primaryActors.union(), ... this.files.keys() ])
  }

  setWritable(actor: string, writable: boolean) {
    this.writable.set(actor, writable);
  }

  localActorId(id: string): string | undefined {
    for (let actor of this.primaryActors.get(id)!) {
      if (this.writable.get(actor) === true) {
        return actor;
      }
    }
    return undefined;
  }

  async actorsAsync(id: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      this.readyQ.push(() => {
        resolve(this.actors(id))
      });
    })
  }

  actors(id: string): string[] {
    return Object.keys(this.clock(id))
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

  clockAt(id: string, actor: string) : number {
    return this.clock(id)[actor] || 0
  }

  clock(id: string) : Clock {
    if (this._clocks[id]) return this._clocks[id]

    const clock: Clock = { [id]: Infinity }; // this also covers the clock for files
    const actors = this.primaryActors.get(id)
    const merges = this.merges.get(id)

    if (actors) actors.forEach(actor => clock[actor] = Infinity)

    if (merges) addTo(clock, merges)

    this._clocks[id] = clock

    return clock
  }

  docsWith(actor: string, seq: number = 1): string[] {
    // this is probably unnecessary
    const key = `${actor}-${seq}`
    if (!this._docsWith.has(key)) {
      const docs = [ ... this.docs ].filter(id => this.has(id, actor, seq));
      this._docsWith.set(key, docs)
    }
    return this._docsWith.get(key)!
  }

  has(id: string, actor: string, seq: number): boolean {
    if (!(seq >= 1)) throw new Error("seq number must be 1 or greater")

    return this.clockAt(id,actor) >= seq;
  }

  merge(id: string, merge: Clock) {
    this.writeThrough({ id, merge });
  }

  addFile(id: string, bytes: number, mimeType: string) {
    this.writeThrough({ id, bytes, mimeType });
  }

  delete(id: string) {
    this.writeThrough({ id, deleted: true });
  }

  addActor(id: string, actorId: string) {
    this.addActors(id, [actorId]);
  }

  addBlocks(blocks: MetadataBlock[]) {
    blocks.forEach(block => {
      this.writeThrough(block);
    });
  }

  addActors(id: string, actors: string[]) {
    this.writeThrough({ id, actors });
  }

  isFile(id: string) : boolean {
    return this.files.get(id) !== undefined
  }

  isKnown(id: string) : boolean {
    return this.isFile(id) || this.isDoc(id)
  }

  isDoc(id: string) : boolean {
    return this.primaryActors.get(id).size > 0
  }

  bench(msg: string, f: () => void): void {
    const start = Date.now();
    f();
    const duration = Date.now() - start;
    const total = (_benchTotal[msg] || 0) + duration
    _benchTotal[msg] = total
    log(`metadata task=${msg} time=${duration}ms total=${total}ms`);
  }

  publicMetadata(id: string, cb: (meta: PublicMetadata | null) => void) {
    this.readyQ.push(() => {
      if (this.isDoc(id)) {
        cb({
          type: "Document",
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
          type: "File",
          bytes,
          mimeType
        })
      } else {
        cb(null)
      }
    })
  }

  forDoc(id: string): MetadataBlock {
    return {
      id,
      actors: [...this.primaryActors.get(id)],
//      follows: [...this.follows.get(id)],
      merge: this.merges.get(id) || {}
    };
  }

  forActor(actor: string): MetadataBlock[] {
    return this.docsWith(actor).map(id => this.forDoc(id));
  }
}


export type PublicMetadata =
  | PublicDocMetadata
  | PublicFileMetadata

export type PublicDocMetadata = {
  type: "Document";
  clock: Clock;
  history: number;
  actor: string | undefined;
  actors: string[];
//  follows: string[];
}

export type PublicFileMetadata = {
  type: "File" ;
  bytes: number;
  mimeType: string;
}


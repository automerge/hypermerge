import Queue from "./Queue";
import MapSet from "./MapSet";
import * as Base58 from "bs58";
import { hypercore, readFeed, Feed } from "./hypercore";
import Debug from "debug";
import * as URL from "url"
const log = Debug("repo:metadata");

import { Clock, equivalent, union, intersection } from "./Clock";

export function validateMetadataMsg(input: Uint8Array): MetadataBlock[] {
  try {
    const result = JSON.parse(input.toString());
    if (result instanceof Array) {
      return filterMetadataInputs(result);
    } else {
      log("WARNING: Metadata Msg is not an array");
      return [];
    }
  } catch (e) {
    log("WARNING: Metadata Msg is invalid JSON");
    return [];
  }
}

export function cleanMetadataInput(input: any): MetadataBlock | undefined {
  const id = input.id || input.docId;
  if (typeof id !== "string") return undefined;

  const bytes = input.bytes;
  if (typeof bytes !== "undefined" && typeof bytes !== "number")
    return undefined;

  const actors = input.actors || input.actorIds;
  const follows = input.follows;
  const merge = input.merge;
  const mimeType = input.mimeType
  const deleted = input.deleted

  if (actors !== undefined) {
    if (!(actors instanceof Array)) return undefined;
    if (!actors.every(isValidID)) return undefined;
  }

  if (follows !== undefined) {
    if (!(follows instanceof Array)) return undefined;
    if (!follows.every(isValidID)) return undefined;
  }

  if (merge !== undefined) {
    if (typeof merge !== "object") return undefined;
    if (!Object.keys(merge).every(isValidID)) return undefined;
    if (!Object.values(merge).every(isNumber)) return undefined;
  }

  const meta = actors || follows || merge || deleted;

  if (meta === undefined && bytes === undefined) return undefined;

  if (meta !== undefined && bytes !== undefined) return undefined;

  return {
    id,
    bytes,
    mimeType,
    actors,
    follows,
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
  follows?: string[];
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


export class Metadata {
  private primaryActors: MapSet<string, string> = new MapSet();
  private follows: MapSet<string, string> = new MapSet();
  private files: Map<string, number> = new Map();
  private mimeTypes: Map<string, string> = new Map();
  private merges: Map<string, Clock> = new Map();
  readyQ: Queue<() => void> = new Queue(); // FIXME - need a better api for accessing metadata
  private clocks: Map<string, Clock> = new Map();

  master: Clock = {}

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

  private ledger: Feed<any>;
  public id: Buffer // for the RepoBackend... used in examples (unwisely!) as a Peer ID

  constructor(storageFn: Function) {
    this.ledger = hypercore(storageFn("ledger"), {
      valueEncoding: "json"
    });
    this.id = this.ledger.id
    log("LEDGER READY (1)")
    this.ledger.ready(() => {
      log("LEDGER READY (2)",this.ledger.length)
      readFeed("ledger", this.ledger, this.loadLedger);
    });
  }

  private loadLedger = (input: any[]) => {
    const data = filterMetadataInputs(input); // FIXME
    this.primaryActors = new MapSet();
    this.follows = new MapSet();
    this.files = new Map();
    this.mimeTypes = new Map();
    this.merges = new Map();
    this.ready = true;
    this.batchAdd(data);
    this.replay.map(this.writeThrough);
    this.replay = [];
    this.genClocks();
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

    if (this.ready && dirty) this.append(block);

    this.genClocks();
  };

  private append = (block: MetadataBlock) => {
    this.ledger.append(block);
  }

  private addBlock(idx: number, block: MetadataBlock): boolean {
    let changedActors = false;
    let changedFollow = false;
    let changedFiles = false;
    let changedMerge = false;
    let changedDeleted = false;
    let id = block.id;

    if (block.actors !== undefined) {
      changedActors = this.primaryActors.merge(id, block.actors);
    }

    if (block.follows !== undefined) {
      changedFollow = this.follows.merge(id, block.follows);
    }

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

    if (block.deleted === true) {
      if (this.files.get(id) !== undefined || this.primaryActors.get(id) !== undefined) {
        this.files.delete(id)
        this.mimeTypes.delete(id)
        this.merges.delete(id)
        this.primaryActors.delete(id)
        this.follows.delete(id)
        changedDeleted = true
      }
    }

    return changedActors || changedFollow || changedMerge || changedFiles || changedDeleted;
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

  actorsAsync(id: string, cb: (actors: string[]) => void) {
    this.readyQ.push(() => {
      cb(this.actors(id));
    });
  }

  actors(id: string): string[] {
    return this.actorsSeen(id, [], new Set());
  }

  // FIXME - i really need a hell scenario test for this
  // prevent cyclical dependancies from causing an infinite search
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

  clock(id: string): Clock {
    return this.clocks.get(id)!;
  }

  private genClock(id: string): Clock {
    const infinityClock: Clock = {};
    this.actors(id).forEach(actor => {
      infinityClock[actor] = Infinity;
    });
    return union(this.merges.get(id) || {}, infinityClock);
  }

  private genClocks() {
    // dont really need to regen them all (but follow...)
    var master : Clock = {}
    const clocks: Map<string, Clock> = new Map();
    const docs = this.primaryActors.keys().forEach(id => {
      const clock = this.genClock(id)
      clocks.set(id, clock)
      master = union(clock,master)
    });
    this.clocks = clocks;
    this.master = master
  }

  docsWith(actor: string, seq: number = 1): string[] {
    return this.docs().filter(id => this.has(id, actor, seq));
  }

  covered(id: string, clock: Clock): Clock {
    return intersection(this.clock(id), clock);
  }

  docs(): string[] {
    return [...this.clocks.keys()];
  }

  has(id: string, actor: string, seq: number): boolean {
    if (!(seq >= 1)) throw new Error("seq number must be 1 or greater")

    return (this.clock(id)[actor] || -1) >= seq;
  }

  merge(id: string, merge: Clock) {
    this.writeThrough({ id, merge });
  }

  follow(id: string, follow: string) {
    this.writeThrough({ id, follows: [follow] });
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

  publicMetadata(id: string, cb: (meta: PublicMetadata | null) => void) {
    this.readyQ.push(() => {
      if (this.isDoc(id)) {
        cb({
          type: "Document",
          clock: {},
          history: 0,
          actor: this.localActorId(id), // FIXME - why is this undefined??
          actors: this.actors(id),
          follows: [...this.follows.get(id)] 
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
      follows: [...this.follows.get(id)],
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
  follows: string[];
}

export type PublicFileMetadata = {
  type: "File" ;
  bytes: number;
  mimeType: string;
}



import Queue from "./Queue"
import MapSet from "./MapSet"
import { readFeed, Feed } from "./hypercore"

import { Clock, equivalent, union, intersection } from "./Clock"

export interface MetadataBlock {
  docId: string
  actorIds?: string[]
  follows?: string[]
  merge?: Clock
}

class MetadataState {
}

export class Metadata {
  private primaryActors: MapSet<string,string> = new MapSet()
  private follows: MapSet<string,string> = new MapSet()
  private merges: Map<string,Clock> = new Map()
  private readyQ: Queue<() => void> = new Queue()
  private clocks: Map<string,Clock> = new Map()

  private writable: Map<string,boolean> = new Map()

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

  private ledger: Feed<MetadataBlock>


  constructor(ledger : Feed<MetadataBlock>) {
    this.ledger = ledger
    this.ledger.ready(() => {
      readFeed(this.ledger, this.loadLedger)
    })
  }

  private loadLedger = (data: MetadataBlock[]) => {
    this.primaryActors = new MapSet()
    this.follows = new MapSet()
    this.merges = new Map()
    this.ready = true
    this.batchAdd(data)
    this.replay.map(this.writeThrough)
    this.replay = []
    this.genClocks()
    this.readyQ.subscribe(f => f())
  }

  private hasBlock(block: MetadataBlock) : boolean {
    return false
  }

  private batchAdd(blocks: MetadataBlock[]) {
    blocks.forEach( block => this.addBlock(block) )
  }

  // write through caching strategy
  private writeThrough = (block: MetadataBlock) => {

    if (!this.ready) this.replay.push(block)

    const dirty = this.addBlock(block)

    if (this.ready && dirty) this.ledger.append(block)

    this.genClocks()
  }

  private addBlock(block: MetadataBlock) : boolean {
    let changedActors = false
    let changedFollow = false
    let changedMerge = false
    let id = block.docId

    if (block.actorIds !== undefined) {
      changedActors = this.primaryActors.merge(id, block.actorIds)
    }

    if (block.follows !== undefined) {
      changedFollow = this.follows.merge(id, block.follows)
    }

    if (block.merge !== undefined) {
      const oldClock : Clock = this.merges.get(id) || {}
      const newClock = union(oldClock, block.merge)
      changedMerge = !equivalent(newClock,oldClock)
      if (changedMerge) {
        this.merges.set(id, newClock)
      }
    }

    return changedActors || changedFollow || changedMerge
  }

  setWritable(actor: string, writable: boolean) {
    this.writable.set(actor,writable)
  }

  localActor(actor: string) : string | undefined {
    for (let id of this.primaryActors.get(actor)!) {
      if (this.writable.get(id) === true) {
        return id
      }
    }
    return undefined
  }

  actorsAsync(id: string, cb: (actors: Set<string>) => void) {
    this.readyQ.push(() => {
      cb(this.actors(id))
    })
  }

  actors(id: string) : Set<string> {
    const actors = this.actorsSeen(id, [], new Set())
    return new Set([ ... actors ])
  }

  // FIXME - i really need a hell scenario test for this
  // prevent cyclical dependancies from causing an infinite search
  private actorsSeen(id: string, acc: string[], seen: Set<string>) : string[] {
    const primaryActors = this.primaryActors.get(id)!
    acc.push( ... primaryActors )
    seen.add(id)
    this.follows.get(id).forEach(follow => {
      if (!seen.has(follow)) {
        this.actorsSeen(follow, acc, seen)
      }
    })
    return acc
  }

  clock(id: string) : Clock {
    return this.clocks.get(id)!
  }

  private genClock(id: string) : Clock {
    const infinityClock : Clock = {}
    this.actors(id).forEach( actor => {
      infinityClock[actor] = Infinity
    })
    return union(this.merges.get(id) || {}, infinityClock)
  }

  private genClocks() {
    // dont really need to regen them all (but follow...)
    const clocks : Map<string,Clock> = new Map()
    const docs = this.primaryActors.keys().forEach( id => {
      clocks.set(id , this.genClock(id))
    })
    this.clocks = clocks
  }

  docsWith(actor: string, seq: number = 0) : string[] {
    return this.docs().filter(id => this.has(id, actor, seq))
  }

  covered(id: string, clock: Clock) : Clock {
    return intersection(this.clock(id), clock)
  }

  docs() : string[] {
    return [ ... this.clocks.keys() ]
  }

  has(id: string, actor: string, seq: number) : boolean {
    return (this.clock(id)[actor] || 0) >= seq
  }

  merge(id: string, merge: Clock ) {
    this.writeThrough({ docId: id, merge })
  }

  follow( id: string, follow: string ) {
    this.writeThrough({ docId: id, follows: [ follow ] })
  }

  addActor( id: string, actorId: string) {
    this.addActors(id, [ actorId ])
  }

  addBlocks( blocks: MetadataBlock[] ) {
    blocks.forEach( block => {
      this.writeThrough( block )
    })
  }

  addActors( id: string, actorIds: string[] ) {
    this.writeThrough({ docId: id, actorIds })
  }

  forDoc( id: string ) : MetadataBlock {
    return {
      docId: id,
      actorIds: [ ... this.primaryActors.get(id) ],
      follows: [ ... this.follows.get(id) ],
      merge: this.merges.get(id) || {}
    }
  }

  forActor( actor: string) : MetadataBlock[] {
    return this.docsWith(actor, 0).map(id => this.forDoc(id))
  }
}

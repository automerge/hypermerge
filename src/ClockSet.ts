
import { Clock } from "automerge/backend"

export function clock(input: string | string[]) : Clock {
  if (typeof input === 'string') {
    return { [input]: Infinity }
  } else {
    let ids : string[] = input
    let clock : Clock = {}
    ids.map(str => str.split(":")).forEach(([id,max]) => {
      clock[id] = max ? parseInt(max) : Infinity
    })
    return clock
  }
}

export function clock2strs(clock: Clock) : string[] {
  let ids = []
  for (let id in clock) {
    const max = clock[id]
    if (max === Infinity) {
      ids.push(id)
    } else {
      ids.push( id + ":" + max)
    }
  }
  return ids
}

function merge(c1 : Clock, c2: Clock) : Clock {
  const actors = new Set([... Object.keys(c1), ... Object.keys(c2)])
  let tmp : Clock = {}
  actors.forEach( actor => {
    tmp[actor] = Math.max(c1[actor] || 0, c2[actor] || 0)
  })
  return tmp
}

export class ClockSet {
  private docActorSeq: Map<string, Clock> = new Map()
  private actorDocSeq: Map<string, Clock> = new Map()

  add(doc: string, val: Clock) {
    const updates = merge(this.clock(doc), val)
    this.docActorSeq.set(doc, updates)
    for (let actor in updates) {
      const seq = updates[actor]
      this.actorDocSeq.set(actor, { ... this.docMap(actor), [doc]: seq })
    }
  }

  seq(doc: string, actor: string) : number {
    return this.clock(doc)[actor] || 0
  }

  docSeq(actor: string, doc: string) : number {
    return this.docMap(actor)[doc] || 0
  }

  docsWith(actor: string, seq: number) : string[] {
    const docSeq = this.docMap(actor)
    const docIds = Object.keys(docSeq)
    return docIds.filter(id => (seq <= docSeq[id]))
  }

  clock(doc: string) : Clock {
    return this.docActorSeq.get(doc) || {}
  }

  docMap(actor: string) : Clock {
    return this.actorDocSeq.get(actor) || {}
  }

  has(doc: string, clock: Clock) : Boolean {
    for (let actor in clock) {
      const seq = clock[actor]
      if ((this.clock(doc)[actor] || 0) < seq) {
        return false
      }
    }
    return true
  }
}

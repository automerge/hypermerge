

export interface Clock {
  [actorId: string]: number
}

export function clockDebug(c : Clock) : string {
  const d : any = {}
  Object.keys(c).forEach( actor => {
    const short = actor.substr(0,5)
    d[short] = c[actor]
  })
  return JSON.stringify(d)
}

export function equivalent(c1 : Clock, c2: Clock) : boolean {
  const actors = new Set([... Object.keys(c1), ... Object.keys(c2)])
  for (let actor of actors) {
    if (c1[actor] != c2[actor]) {
      return false
    }
  }
  return true
}

export function union(c1 : Clock, c2: Clock) : Clock {
  const actors = new Set([... Object.keys(c1), ... Object.keys(c2)])
  let tmp : Clock = {}
  actors.forEach( actor => {
    tmp[actor] = Math.max(c1[actor] || 0, c2[actor] || 0)
  })
  return tmp
}

export function intersection(c1 : Clock, c2: Clock) : Clock {
  const actors = new Set([... Object.keys(c1), ... Object.keys(c2)])
  let tmp : Clock = {}
  actors.forEach( actor => {
    const val = Math.min(c1[actor] || 0, c2[actor] || 0)
    if (val > 0) {
      tmp[actor] = val
    }
  })
  return tmp
}


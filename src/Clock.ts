export interface Clock {
  [actorId: string]: number;
}

export type CMP = "GT" | "LT" | "CONCUR" | "EQ"

export function gte(a: Clock, b: Clock) : boolean {
  for (let id in a) {
    if ( a[id] < (b[id] || 0) )
      return false
  }
  for (let id in b) {
    if ( b[id] > (a[id] || 0) )
      return false
  }
  return true
}

export function cmp(a: Clock, b: Clock) : CMP {
  const aGTE = gte(a,b)
  const bGTE = gte(b,a)
  if (aGTE && bGTE) {
    return "EQ"
  } else if (aGTE && !bGTE) {
    return "GT"
  } else if (!aGTE && bGTE) {
    return "LT"
  }
  return "CONCUR"
}

export function strs2clock(input: string | string[]): Clock {
  if (typeof input === "string") {
    return { [input]: Infinity };
  } else {
    let ids: string[] = input;
    let clock: Clock = {};
    ids
      .map(str => str.split(":"))
      .forEach(([id, max]) => {
        clock[id] = max ? parseInt(max) : Infinity;
      });
    return clock;
  }
}

export function clock2strs(clock: Clock): string[] {
  let ids = [];
  for (let id in clock) {
    const max = clock[id];
    if (max === Infinity) {
      ids.push(id);
    } else {
      ids.push(id + ":" + max);
    }
  }
  return ids;
}

export function clockDebug(c: Clock): string {
  const d: any = {};
  Object.keys(c).forEach(actor => {
    const short = actor.substr(0, 5);
    d[short] = c[actor];
  });
  return JSON.stringify(d);
}

export function equivalent(c1: Clock, c2: Clock): boolean {
  const actors = new Set([...Object.keys(c1), ...Object.keys(c2)]);
  for (let actor of actors) {
    if (c1[actor] != c2[actor]) {
      return false;
    }
  }
  return true;
}

export function union(c1: Clock, c2: Clock | undefined): Clock {
  let acc: Clock = Object.assign({}, c1)

  if (c2) for (let id in c2) {
    acc[id] = Math.max(acc[id] || 0, c2[id])
  }

  return acc
}

export function addTo(acc: Clock, clock: Clock) {
  for (let actor in clock ) {
    acc[actor] = Math.max(acc[actor] || 0, clock[actor])
  }
}

export function intersection(c1: Clock, c2: Clock): Clock {
  const actors = new Set([...Object.keys(c1), ...Object.keys(c2)]);
  let tmp: Clock = {};
  actors.forEach(actor => {
    const val = Math.min(c1[actor] || 0, c2[actor] || 0);
    if (val > 0) {
      tmp[actor] = val;
    }
  });
  return tmp;
}

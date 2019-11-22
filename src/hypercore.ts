import { Feed } from 'hypercore'

import Debug from './Debug'
import { ID, ActorId } from './Misc'
const log = Debug('hypercore')

function readFeedN<T>(
  id: ActorId | 'ledger',
  feed: Feed<T>,
  index: number,
  cb: (data: T[]) => void
) {
  log(`readFeedN id=${ID(id)} (0..${index})`)

  if (index === 0) {
    feed.get(0, { wait: false }, (err, data) => {
      if (err) log(`feed.get() error id=${ID(id)}`, err)
      if (err) throw err
      cb([data])
    })
  } else {
    feed.getBatch(0, index, { wait: false }, (err, data) => {
      if (err) log(`feed.getBatch error id=${ID(id)}`, err)
      if (err) throw err
      cb(data)
    })
  }
}

export function readFeed<T>(id: ActorId | 'ledger', feed: Feed<T>, cb: (data: T[]) => void) {
  //  const id = feed.id.toString('hex').slice(0,4)
  const length = feed.downloaded()

  log(`readFeed ${ID(id)} downloaded=${length} feed.length=${feed.length}`)

  if (length === 0) return cb([])
  if (feed.has(0, length)) return readFeedN(id, feed, length, cb)

  for (let i = 0; i < length; i++) {
    if (!feed.has(i)) {
      feed.clear(i, feed.length, () => {
        log(`post clear -- readFeedN id=${ID(id)} n=${i - 1}`)
        readFeedN(id, feed, i - 1, cb)
      })
      break
    }
  }
}

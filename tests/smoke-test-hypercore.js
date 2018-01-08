const assert = require('assert')
const EventEmitter = require('events')
const Automerge = require('automerge')
const {WatchableDoc} = require('automerge')
const ram = require('random-access-memory')
const pump = require('pump')
const through2 = require('through2')
const hypermerge = require('..')

class ChangeList extends EventEmitter {
  constructor (actor, watchableDoc, feed) {
    super()
    this.actor = actor
    this.watchableDoc = watchableDoc
    this.watchableDoc.registerHandler(this.newChange.bind(this))
    this.previousDoc = this.watchableDoc.get()
    this.feed = feed
  }

  newChange (doc) {
    if (this.previousDoc) {
      const changes = Automerge.getChanges(this.previousDoc, doc)
      changes
        .filter(change => change.actor === this.actor)
        .filter(change => change.seq >= this.feed.length)
        .forEach(change => {
          const {actor, seq, ...props} = change
          this.emit('change', change)
          this.feed.append(change, err => {
            if (err) {
              console.error('Error ' + change.seq, err)
            }
            // console.log('Appended', this.feed.length)
          })
        })
    }
    this.previousDoc = this.watchableDoc.get()
  }
}

function newFeed(key) {
  const promise = new Promise((resolve, reject) => {
    const hm = hypermerge(ram, key)
    hm.on('ready', () => {
      resolve(hm)
    })
    hm.on('error', err => reject(err))
  })
  return promise
}

let aliceDoc, bobDoc
let aliceFeed, aliceFeedRemote
let bobFeed, bobFeedRemote

describe('smoke test, no hypercore, missing deps', () => {
  // https://github.com/inkandswitch/hypermerge/wiki/Smoke-Test
  
  before(async () => {
    aliceDoc = new WatchableDoc(Automerge.init('alice'))
    bobDoc = new WatchableDoc(Automerge.init('bob'))
    let online = true

    aliceFeed = (await newFeed()).source
    const aliceChanges = new ChangeList('alice', aliceDoc, aliceFeed)
    aliceChanges.on('change', change => {
      const {actor, seq, ...props} = change
      // console.log('%s-%d %O', actor, seq, props)
    })

    bobFeed = (await newFeed()).source
    const bobChanges = new ChangeList('bob', bobDoc, bobFeed)
    bobChanges.on('change', change => {
      const {actor, seq, ...props} = change
      // console.log('%s-%d %O', actor, seq, props)
    })

    aliceFeedRemote = (await newFeed(aliceFeed.key)).source
    // console.log('Jim', aliceFeed.key, aliceFeed.writable)
    // console.log('Jim2', aliceFeedRemote.key, aliceFeedRemote.writable)
    const aliceLocal = aliceFeed.replicate({live: true, encrypt: false})
    const aliceRemote = aliceFeedRemote.replicate({live: true, encrypt: false})
    pump(
      aliceLocal,
			through2(function (chunk, enc, cb) {
				// console.log('alice l --> r', chunk)
        if (online) this.push(chunk)
				cb()
			}),
      aliceRemote,
			through2(function (chunk, enc, cb) {
				// console.log('alice l <-- r', chunk)
				if (online) this.push(chunk)
				cb()
			}),
      aliceLocal,
      err => {
        if (err) {
          console.error('Alice replicate error', err)
        }
      }
    )
    aliceFeed.on('append', () => {
      // console.log('append alice')
    })
    let lastSeenAlice = 0
    aliceFeedRemote.on('append', err => {
      if (err) {
        console.error('append alice error', err)
        return
      }
      // console.log('append alice remote', aliceFeedRemote.length)
    })
    aliceFeedRemote.on('sync', err => {
      if (err) {
        console.error('sync alice error', err)
        return
      }
      // console.log('sync alice remote', aliceFeedRemote.length)
      const prevLastSeenAlice = lastSeenAlice
      lastSeenAlice = aliceFeedRemote.length
      for (let i = prevLastSeenAlice + 1; i <= lastSeenAlice; i++) {
        // console.log('Fetch', i)
        aliceFeedRemote.get(i - 1, (err, change) => {
          if (err) {
            console.error('Error alice remote', i, err)
            return
          }
          // console.log('Fetched alice', i, change)
          bobDoc.applyChanges([change])
        })
      }
    })

    // bobFeedRemote = await (newFeed(bobFeed.key)).source
    bobFeedRemote = (await newFeed(bobFeed.key)).source
    // console.log('Jim', bobFeed.key, bobFeed.writable)
    // console.log('Jim2', bobFeedRemote.key, bobFeedRemote.writable)
    const bobLocal = bobFeed.replicate({live: true, encrypt: false})
    const bobRemote = bobFeedRemote.replicate({live: true, encrypt: false})
    pump(
      bobLocal,
			through2(function (chunk, enc, cb) {
				// console.log('bob l --> r', chunk)
				if (online) this.push(chunk)
				cb()
			}),
      bobRemote,
			through2(function (chunk, enc, cb) {
				// console.log('bob l <-- r', chunk)
				if (online) this.push(chunk)
				cb()
			}),
      bobLocal,
      err => {
        if (err) {
          console.error('Bob replicate error', err)
        }
      }
    )
    bobFeed.on('append', () => {
      // console.log('append bob')
    })
    let lastSeenBob = 0
    bobFeedRemote.on('append', err => {
      if (err) {
        console.error('append bob error', err)
        return
      }
      // console.log('append bob remote', bobFeedRemote.length)
    })
    bobFeedRemote.on('sync', err => {
      if (err) {
        console.error('sync bob error', err)
        return
      }
      // console.log('sync bob remote', bobFeedRemote.length)
      const prevLastSeenBob = lastSeenBob
      lastSeenBob = bobFeedRemote.length
      for (let i = prevLastSeenBob + 1; i <= lastSeenBob; i++) {
        // console.log('Fetch bob', i)
        bobFeedRemote.get(i - 1, (err, change) => {
          if (err) {
            console.error('Error bob remote', i, err)
            return
          }
          // console.log('Fetched bob', i, change)
          aliceDoc.applyChanges([change])
        })
      }
    })
  })

  function goOffline () {
    online = false
  }

  function goOnline () {
    online = true
  }

  it('1. Both Alice and Bob start with the same blank canvas. ' +
     'Both are online.', () => {
    aliceDoc.set(Automerge.change(aliceDoc.get(), 'blank canvas', doc => {
      doc.x0y0 = 'w'
      doc.x0y1 = 'w'
      doc.x1y0 = 'w'
      doc.x1y1 = 'w'
    }))
    assert.deepEqual(aliceDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'w', x0y1: 'w', x1y0: 'w', x1y1: 'w'
    })
    bobDoc.set(Automerge.merge(bobDoc.get(), aliceDoc.get()))
    assert.deepEqual(bobDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'w', x0y1: 'w', x1y0: 'w', x1y1: 'w'
    })
    /*
    aliceFeedRemote.once('append', () => {
      console.log('test 1. append remote')
      done()
    })
    */
    /*
    setTimeout(() => {
      console.log('Remote length', aliceFeedRemote.length) 
      done()
    }, 1000)
    */
  })

  it('2. Alice makes an edit', () => {
    aliceDoc.set(Automerge.change(
      aliceDoc.get(), 'alice adds red pixel',
      doc => { doc.x0y0 = 'r' }
    ))
    assert.deepEqual(aliceDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r', x0y1: 'w', x1y0: 'w', x1y1: 'w'
    })
  })

  it(`2a. Alice's edit gets synced over to Bob's canvas`, () => {
    assert.deepEqual(bobDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r', x0y1: 'w', x1y0: 'w', x1y1: 'w'
    })
    assert.deepEqual(bobDoc.get()._conflicts, {})
  })

  it('3. Bob makes an edit', () => {
    bobDoc.set(Automerge.change(
      bobDoc.get(), 'bob adds blue pixel',
      doc => { doc.x1y1 = 'b' }
    ))
    assert.deepEqual(bobDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r', x0y1: 'w', x1y0: 'w', x1y1: 'b'
    })
    // setTimeout(done, 1000)
    // done()
  })

  it(`3a. Bob's edit gets synced to Alice's canvas`, () => {
    assert.deepEqual(aliceDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r', x0y1: 'w', x1y0: 'w', x1y1: 'b'
    })
    assert.deepEqual(aliceDoc.get()._conflicts, {})
  })
  
  it('4. Alice and/or Bob go offline', () => {
    goOffline()
  })

  it('5. Both Alice and Bob make edits while offline', () => {
    aliceDoc.set(Automerge.change(
      aliceDoc.get(), 'alice adds green and red pixels',
      doc => {
        doc.x1y0 = 'g'
        doc.x1y1 = 'r'
      }
    ))
    bobDoc.set(Automerge.change(
      bobDoc.get(), 'bob adds green and white pixels',
      doc => {
        doc.x1y0 = 'g'
        doc.x1y1 = 'w'
      }
    ))
    assert.deepEqual(aliceDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r', x0y1: 'w', x1y0: 'g', x1y1: 'r'
    })
    assert.deepEqual(bobDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r', x0y1: 'w', x1y0: 'g', x1y1: 'w'
    })
  })

  it('6. Alice and Bob both go back online, and re-sync', () => {
    goOnline()
    assert.deepEqual(aliceDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r', x0y1: 'w', x1y0: 'g', x1y1: 'w'
    })
    assert.deepEqual(aliceDoc.get()._conflicts, {
      x1y0: {
        alice: 'g'
      },
      x1y1: {
        alice: 'r'
      }
    })
    assert.deepEqual(bobDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r', x0y1: 'w', x1y0: 'g', x1y1: 'w'
    })
    assert.deepEqual(bobDoc.get()._conflicts, {
      x1y0: {
        alice: 'g'
      },
      x1y1: {
        alice: 'r'
      }
    })
  })
})

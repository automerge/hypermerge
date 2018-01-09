const assert = require('assert')
const EventEmitter = require('events')
const Automerge = require('automerge')
const {WatchableDoc} = require('automerge')

class ChangeList extends EventEmitter {
  constructor (actor, watchableDoc) {
    super()
    this.actor = actor
    this.watchableDoc = watchableDoc
    this.watchableDoc.registerHandler(this.newChange.bind(this))
    this.changes = []
    this.previousDoc = this.watchableDoc.get()
  }

  newChange (doc) {
    if (this.previousDoc) {
      const changes = Automerge.getChanges(this.previousDoc, doc)
      changes
        .filter(change => change.actor === this.actor)
        .filter(change => !this.changes[change.seq])
        .forEach(change => {
          const {actor, seq, ...props} = change
          this.changes[change.seq] = props
          this.emit('change', change)
        })
    }
    this.previousDoc = this.watchableDoc.get()
  }

  scanForNewChanges (doc, base) {
  }
}

let aliceDoc, bobDoc
/* global it, describe */

describe('smoke test, no hypercore, missing deps', () => {
  // https://github.com/inkandswitch/hypermerge/wiki/Smoke-Test

  aliceDoc = new WatchableDoc(Automerge.init('alice'))
  bobDoc = new WatchableDoc(Automerge.init('bob'))
  let online = true

  const aliceChanges = new ChangeList('alice', aliceDoc)
  const aliceChangesOffline = []
  aliceChanges.on('change', change => {
    if (online) {
      bobDoc.applyChanges([change])
    } else {
      aliceChangesOffline.push(change)
    }
  })
  /*
  aliceChanges.on('change', change => {
    const {actor, seq, ...props} = change
    // console.log('%s-%d %O', actor, seq, props)
  })
  */

  const bobChanges = new ChangeList('bob', bobDoc)
  const bobChangesOffline = []
  bobChanges.on('change', change => {
    if (online) {
      aliceDoc.applyChanges([change])
    } else {
      bobChangesOffline.push(change)
    }
  })
  /*
  bobChanges.on('change', change => {
    const {actor, seq, ...props} = change
    // console.log('%s-%d %O', actor, seq, props)
  })
  */

  function goOffline () {
    online = false
  }

  function goOnline () {
    online = true
    bobDoc.applyChanges(aliceChangesOffline)
    aliceChangesOffline.length = 0
    aliceDoc.applyChanges(bobChangesOffline)
    bobChangesOffline.length = 0
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
      x0y0: 'w',
      x0y1: 'w',
      x1y0: 'w',
      x1y1: 'w'
    })
    bobDoc.set(Automerge.merge(bobDoc.get(), aliceDoc.get()))
    assert.deepEqual(bobDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'w',
      x0y1: 'w',
      x1y0: 'w',
      x1y1: 'w'
    })
  })

  it('2. Alice makes an edit', () => {
    aliceDoc.set(Automerge.change(
      aliceDoc.get(), 'alice adds red pixel',
      doc => { doc.x0y0 = 'r' }
    ))
    assert.deepEqual(aliceDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r',
      x0y1: 'w',
      x1y0: 'w',
      x1y1: 'w'
    })
  })

  it(`2a. Alice's edit gets synced over to Bob's canvas`, () => {
    assert.deepEqual(bobDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r',
      x0y1: 'w',
      x1y0: 'w',
      x1y1: 'w'
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
      x0y0: 'r',
      x0y1: 'w',
      x1y0: 'w',
      x1y1: 'b'
    })
  })

  it(`3a. Bob's edit gets synced to Alice's canvas`, () => {
    assert.deepEqual(aliceDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r',
      x0y1: 'w',
      x1y0: 'w',
      x1y1: 'b'
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
      x0y0: 'r',
      x0y1: 'w',
      x1y0: 'g',
      x1y1: 'r'
    })
    assert.deepEqual(bobDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r',
      x0y1: 'w',
      x1y0: 'g',
      x1y1: 'w'
    })
  })

  it('6. Alice and Bob both go back online, and re-sync', () => {
    goOnline()
    assert.deepEqual(aliceDoc.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r',
      x0y1: 'w',
      x1y0: 'g',
      x1y1: 'w'
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
      x0y0: 'r',
      x0y1: 'w',
      x1y0: 'g',
      x1y1: 'w'
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

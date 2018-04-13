const test = require('tape')
const Hypermerge = require('..')
const ram = require('random-access-memory')
const OnlineOfflinePump = require('./lib/online-offline-pump')

test('setup', t => {
  t.plan(2)

  const hm1 = new Hypermerge({path: ram})
  t.ok(hm1, 'is truthy')
  hm1.once('ready', merge => {
    t.equal(merge, hm1, 'calls ready with itself')
  })
})

test('.any() returns false with no documents', t => {
  t.plan(1)

  const hm1 = new Hypermerge({path: ram})
  t.notOk(hm1.any(), 'empty hypermerge return false for .any()')
})

test('create a new actor and document', t => {
  t.plan(2)
  const hm1 = new Hypermerge({path: ram})
  hm1.once('ready', () => {
    const doc1 = hm1.create()
    t.deepEqual(doc1, {
      _objectId: '00000000-0000-0000-0000-000000000000'
    }, 'expected empty automerge doc')
    hm1.once('document:ready', (hex, doc) => {
      t.equal(doc1, doc)
    })
  })
})

test('.any() returns true with some documents', t => {
  t.plan(1)
  const hm1 = new Hypermerge({path: ram})
  hm1.once('ready', () => {
    hm1.create()
    hm1.once('document:ready', (hex, doc) => {
      t.ok(hm1.any(), 'hypermerge with doc return true for .any()')
    })
  })
})

test('.update() a document and .open() it on a second node', t => {
  // t.plan(4)

  const hm1 = new Hypermerge({path: ram})
  hm1.once('ready', () => {
    const hm2 = new Hypermerge({path: ram})
    hm2.once('ready', () => {
      const pump = new OnlineOfflinePump(hm1, hm2)

      let doc1 = hm1.create()

      // document:updated only receives below if we open after hm1 is ready:
      hm1.once('document:ready', id => {
        pump.goOnline()
        t.equal(id, hm1.getId(doc1), 'readied id should be the doc we created')
        hm2.open(id)
      })

      hm2.once('document:ready', (id, doc2) => {
        t.deepEqual(doc2, {
          _objectId: '00000000-0000-0000-0000-000000000000'
        }, 'empty doc propagates to hm2')

        doc1 = hm1.change(doc1, doc => {
          doc.test = 1
        })
      })

      hm2.once('document:updated', (id, doc2, pDoc2) => {
        t.deepEqual(doc2, {
          _objectId: '00000000-0000-0000-0000-000000000000',
          test: 1
        }, 'changes propagate to hm2')

        t.deepEqual(pDoc2, {
          _objectId: '00000000-0000-0000-0000-000000000000'
        }, 'the previously empty doc is provided')

        hm2.change(doc2, doc => {
          doc.test = 2
        })
      })

      hm1.once('document:updated', (id, doc, pDoc) => {
        t.deepEqual(doc, {
          _objectId: '00000000-0000-0000-0000-000000000000',
          test: 2
        }, 'changes propagate back to hm1')

        t.deepEqual(pDoc, {
          _objectId: '00000000-0000-0000-0000-000000000000',
          test: 1
        }, 'the previous doc version is provided')

        t.end()
      })
    })
  })
})

test('.fork() a document, make changes, and then .merge() it', t => {
  t.plan(4)

  const hm1 = new Hypermerge({path: ram})
  hm1.once('ready', () => {
    const doc1 = hm1.create()
    const id1 = hm1.getId(doc1)

    // first change
    hm1.change(doc1, 'First actor makes a change', doc => {
      doc.test = 1
    })

    t.deepEqual(hm1.find(id1), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      test: 1
    }, 'doc1 contains first change after update')

    // Fork to second document
    const doc2 = hm1.fork(id1)
    const id2 = hm1.getId(doc2)

    t.deepEqual(hm1.find(id2), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      test: 1
    }, 'doc2 contains first change after fork')

    hm1.change(doc2, 'Second actor makes a change', doc => {
      doc.test = 2
    })

    t.deepEqual(hm1.find(id2), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      test: 2
    }, 'doc2 contains second change')

    // Merge back to first document
    hm1.merge(id1, id2)

    t.deepEqual(hm1.find(id1), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      test: 2
    }, 'doc1 contains second change after merge')
  })
})

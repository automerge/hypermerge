const test = require('tape')
const HyperMerge = require('..')
const ram = require('random-access-memory')

let hm1, hm2

test('setup', t => {
  t.plan(3)

  hm1 = new HyperMerge({path: ram, port: 3298})
  hm2 = new HyperMerge({path: ram, port: 3299})

  t.ok(hm1, 'is truthy')

  hm1.once('ready', merge => {
    hm1.joinSwarm()
    t.equal(merge, hm1, 'calls ready with itself')
  })

  hm2.once('ready', merge => {
    hm2.joinSwarm()
    t.equal(merge, hm2, 'calls ready with itself')
  })
})

test('.any() returns false with no documents', t => {
  t.plan(1)
  t.notOk(hm1.any(), 'empty hypermerge return false for .any()')
})

test('create a new actor and document', t => {
  t.plan(2)

  const doc1 = hm1.create()

  t.deepEqual(doc1, {
    _objectId: '00000000-0000-0000-0000-000000000000'
  }, 'expected empty automerge doc')

  hm1.once('document:ready', (hex, doc) => {
    t.equal(doc1, doc)
  })
})

test('.any() returns true with some documents', t => {
  t.plan(1)
  t.ok(hm1.any(), 'hypermerge with doc return true for .any()')
})

test('.update() a document and .open() it on a second node', t => {
  t.plan(4)

  let doc1 = hm1.create()
  const docId = hm1.getId(doc1)

  // document:updated only receives below if we open after hm1 is ready:
  hm1.once('document:ready', id => {
    t.equal(id, hm1.getId(doc1), 'readied id should be the doc we created')

    hm2.open(id)
  })

  hm2.once('document:ready', (id, doc2) => {
    t.deepEqual(doc2, {
      _objectId: '00000000-0000-0000-0000-000000000000',
    }, 'empty doc propogates to hm2')

    doc1 = hm1.change(doc1, doc => {
      doc.test = 1
    })
  })

  hm2.once('document:updated', (id, doc2) => {
    t.deepEqual(doc2, {
      _objectId: '00000000-0000-0000-0000-000000000000',
      test: 1
    }, 'changes propogate to hm2')

    hm2.change(doc2, doc => {
      doc.test = 2
    })
  })

  hm1.once('document:updated', (id, doc) => {
    t.deepEqual(doc, {
      _objectId: '00000000-0000-0000-0000-000000000000',
      test: 2
    }, 'changes propogate back to hm1')
  })
})

test('.fork() a document, make changes, and then .merge() it', t => {
  t.plan(4)

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
  const id2 = hm1.getHex(doc2)

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

test('teardown', t => {
  hm1.swarm.close()
  hm2.swarm.close()
  t.ok(true, 'teardown finished')
  t.end()
})

// FIXME: Test for .delete(hex)

// FIXME: Test for .openAll()

const test = require('tape')
const {HyperMerge} = require('..')
const Automerge = require('automerge')
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
  t.deepEqual(doc1.toJS(), {
    _conflicts: {},
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
  t.plan(2)

  let doc1 = hm1.create()

  doc1 = hm1.update(Automerge.change(doc1, doc => {
    doc.test = 1
  }))

  const docId = hm1.getId(doc1)
  hm2.open(docId)

  hm2.once('document:updated', (id, doc2) => {
    t.deepEqual(doc2.toJS(), {
      _conflicts: {},
      _objectId: '00000000-0000-0000-0000-000000000000',
      test: 1
    }, 'changes propogate to hm2')

    hm2.update(Automerge.change(doc2, doc => {
      doc.test = 2
    }))
  })

  hm1.once('document:updated', (id, doc) => {
    t.deepEqual(doc.toJS(), {
      _conflicts: {},
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
  hm1.update(Automerge.change(doc1, 'First actor makes a change', doc => {
    doc.test = 1
  }))

  t.deepEqual(hm1.find(id1).toJS(), {
    _conflicts: {},
    _objectId: '00000000-0000-0000-0000-000000000000',
    test: 1
  }, 'doc1 contains first change after update')

  // Fork to second document
  const doc2 = hm1.fork(id1)
  const id2 = hm1.getHex(doc2)

  t.deepEqual(hm1.find(id2).toJS(), {
    _conflicts: {},
    _objectId: '00000000-0000-0000-0000-000000000000',
    test: 1
  }, 'doc2 contains first change after fork')

  hm1.update(Automerge.change(doc2, 'Second actor makes a change', doc => {
    doc.test = 2
  }))

  t.deepEqual(hm1.find(id2).toJS(), {
    _conflicts: {},
    _objectId: '00000000-0000-0000-0000-000000000000',
    test: 2
  }, 'doc2 contains second change')

  // Merge back to first document
  hm1.merge(id1, id2)

  t.deepEqual(hm1.find(id1).toJS(), {
    _conflicts: {},
    _objectId: '00000000-0000-0000-0000-000000000000',
    test: 2
  }, 'doc1 contains second change after merge')
})

/*
test('.open() on document with dependencies fetches all of them', t => {
  t.plan(6)
  const hm1 = new HyperMerge({path: ram})
  const hm2 = new HyperMerge({path: ram})
  hm1.core.ready(() => {
    hm2.core.ready(() => {
      const firstDoc = hm1.create()
      const firstActorHex = hm1.getHex(firstDoc)
      hm1.feed(firstActorHex).once('ready', () => {
        // First change
        hm1.update(Automerge.change(
          firstDoc,
          'First actor makes a change',
          doc => {
            doc.test = 1
          }
        ))
        t.deepEqual(hm1.document(firstActorHex).toJS(), {
          _conflicts: {},
          _objectId: '00000000-0000-0000-0000-000000000000',
          test: 1
        })

        // Fork to second document
        const secondDoc = hm1.fork(firstActorHex)
        const secondActorHex = hm1.getHex(secondDoc)
        hm1.feed(secondActorHex).once('ready', () => {
          t.deepEqual(hm1.document(secondActorHex).toJS(), {
            _conflicts: {},
            _objectId: '00000000-0000-0000-0000-000000000000',
            test: 1
          })
          hm1.update(Automerge.change(
            secondDoc,
            'Second actor makes a change',
            doc => {
              doc.test = 2
            }
          ))
          t.deepEqual(hm1.document(secondActorHex).toJS(), {
            _conflicts: {},
            _objectId: '00000000-0000-0000-0000-000000000000',
            test: 2
          })

          // Add a slight delay to give the network a chance to update
          setTimeout(() => {
            // On second hypermerge, .open() the second document
            hm2.open(secondActorHex)
            hm2.on('document:updated', doc => {
              // Evil
              setTimeout(() => {
                t.deepEqual(hm2.document(secondActorHex).toJS(), {
                  _conflicts: {},
                  _objectId: '00000000-0000-0000-0000-000000000000',
                  test: 2
                })
                console.log('Jim3', Object.keys(hm2.feeds))
                t.ok(hm2.feeds[secondActorHex], 'second feed')
                t.ok(hm2.feeds[firstActorHex], 'first feed')

                // Cleanup
                hm1.swarm.close()
                hm2.swarm.close()
              }, 1000)
            })
          })
        })
      })
    })
  })
})
*/

test('teardown', t => {
  hm1.swarm.close()
  hm2.swarm.close()
  t.end()
})

// FIXME: Test for .delete(hex)

// FIXME: Test for .openAll()

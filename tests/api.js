const test = require('tape')
const {HyperMerge} = require('..')
const Automerge = require('automerge')
const ram = require('random-access-memory')

test('constructor', t => {
  t.plan(1)
  const hm = new HyperMerge({path: ram})
  t.ok(hm, 'is truthy')
})

test('create a new actor and document', t => {
  t.plan(1)
  const hm = new HyperMerge({path: ram})
  hm.core.ready(() => {
    const doc = hm.create()
    t.deepEqual(doc.toJS(), {
      _conflicts: {},
      _objectId: '00000000-0000-0000-0000-000000000000'
    }, 'expected empty automerge doc')
  })
})

test('does .any() method work?', t => {
  t.plan(2)
  const hm = new HyperMerge({path: ram})
  hm.core.ready(() => {
    t.notOk(hm.any(), 'empty hypermerge return false for .any()')
    hm.create()
    t.ok(hm.any(), 'hypermerge with doc returns true for .any()')
  })
})

test('does .isWritable() work?', t => {
  t.plan(2)
  const hm1 = new HyperMerge({path: ram}).joinSwarm()
  const hm2 = new HyperMerge({path: ram}).joinSwarm()

  hm1.core.ready(() => {
    hm2.core.ready(() => {
      const writableDoc = hm1.create()
      const hex = hm1.getHex(writableDoc)
      hm1.on('feed:ready', () => {
        t.ok(hm1.isWritable(hex), 'Original doc is writable')
      })
      hm2.open(hex)
      hm2.on('feed:ready', () => {
        t.notOk(hm2.isWritable(hex), 'Cloned doc is read-only')
      })
      hm1.swarm.close()
      hm2.swarm.close()
    })
  })
})

test('.update() a document and .open() it on a second node', t => {
  t.plan(1)
  const hm1 = new HyperMerge({path: ram}).joinSwarm()
  const hm2 = new HyperMerge({path: ram}).joinSwarm()

  const writableDoc = hm1.create()
  const hex = hm1.getHex(writableDoc)
  const newDoc = Automerge.change(writableDoc, doc => {
    doc.test = 1
  })

  hm1.once('document:ready', () => {
    hm1.update(newDoc)
  })

  hm1.core.ready(() => {
    hm2.core.ready(() => {
      // Add a slight delay to give the network a chance to update
      setTimeout(() => {
        hm2.open(hex)

        hm2.once('document:ready', () => {
          const clonedDoc = hm2.open(hex)
          t.deepEqual(clonedDoc.toJS(), {
            _conflicts: {},
            _objectId: '00000000-0000-0000-0000-000000000000',
            test: 1
          })
          hm1.swarm.close()
          hm2.swarm.close()
        })
      }, 1000)
    })
  })
})

test('.fork() a document, make changes, and then .merge() it', t => {
  t.plan(4)
  const hm = new HyperMerge({path: ram})
  hm.core.ready(() => {
    const firstDoc = hm.create()
    const firstActorHex = hm.getHex(firstDoc)
    hm.feed(firstActorHex).once('ready', () => {
      // First change
      hm.update(Automerge.change(
        firstDoc,
        'First actor makes a change',
        doc => {
          doc.test = 1
        }
      ))
      t.deepEqual(hm.document(firstActorHex).toJS(), {
        _conflicts: {},
        _objectId: '00000000-0000-0000-0000-000000000000',
        test: 1
      })

      // Fork to second document
      const secondDoc = hm.fork(firstActorHex)
      const secondActorHex = hm.getHex(secondDoc)
      hm.feed(secondActorHex).once('ready', () => {
        t.deepEqual(hm.document(secondActorHex).toJS(), {
          _conflicts: {},
          _objectId: '00000000-0000-0000-0000-000000000000',
          test: 1
        })
        hm.update(Automerge.change(
          secondDoc,
          'Second actor makes a change',
          doc => {
            doc.test = 2
          }
        ))
        t.deepEqual(hm.document(secondActorHex).toJS(), {
          _conflicts: {},
          _objectId: '00000000-0000-0000-0000-000000000000',
          test: 2
        })

        // Merge back to first document
        hm.merge(firstActorHex, secondActorHex)
        t.deepEqual(hm.document(firstActorHex).toJS(), {
          _conflicts: {},
          _objectId: '00000000-0000-0000-0000-000000000000',
          test: 2
        })
      })
    })
  })
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

// FIXME: Test for .delete(hex)

// FIXME: Test for .openAll()

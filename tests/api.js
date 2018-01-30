const test = require('tape')
const {HyperMerge} = require('..')
const tmp = require('tmp')
const Automerge = require('automerge')

test('constructor', t => {
  t.plan(1)
  const tmpdir = tmp.dirSync({unsafeCleanup: true})
  const hm = new HyperMerge({path: tmpdir.name})
  t.ok(hm, 'is truthy')
  hm.core.ready(() => {
    hm.swarm.close()
    tmpdir.removeCallback()
  })
})

test('create a new actor and document', t => {
  t.plan(1)
  const tmpdir = tmp.dirSync({unsafeCleanup: true})
  const hm = new HyperMerge({path: tmpdir.name})
  hm.core.ready(() => {
    const doc = hm.create()
    t.deepEqual(doc.toJS(), {
      _conflicts: {},
      _objectId: '00000000-0000-0000-0000-000000000000'
    }, 'expected empty automerge doc')
    hm.swarm.close()
    tmpdir.removeCallback()
  })
})

test('does .any() method work?', t => {
  t.plan(2)
  const tmpdir = tmp.dirSync({unsafeCleanup: true})
  const hm = new HyperMerge({path: tmpdir.name})
  hm.core.ready(() => {
    t.notOk(hm.any(), 'empty hypermerge return false for .any()')
    hm.create()
    t.ok(hm.any(), 'hypermerge with doc returns true for .any()')
    hm.swarm.close()
    tmpdir.removeCallback()
  })
})

test('does .isWritable() work?', t => {
  t.plan(2)
  const tmpdir1 = tmp.dirSync({unsafeCleanup: true})
  const hm1 = new HyperMerge({path: tmpdir1.name})
  const tmpdir2 = tmp.dirSync({unsafeCleanup: true})
  const hm2 = new HyperMerge({path: tmpdir2.name})
  hm1.core.ready(() => {
    hm2.core.ready(() => {
      const writableDoc = hm1.create()
      const hex = hm1.getHex(writableDoc)
      hm1.on('document:ready', () => {
        const feed = hm1.feed(hex)
        feed.ready(() => {
          t.ok(hm1.isWritable(hex), 'Original doc is writable')
        })
      })
      hm2.open(hex)
      hm2.on('document:ready', () => {
        const feed = hm2.feed(hex)
        feed.ready(() => {
          t.notOk(hm2.isWritable(hex), 'Cloned doc is read-only')
        })
      })
      hm1.swarm.close()
      hm2.swarm.close()
      tmpdir1.removeCallback()
      tmpdir2.removeCallback()
    })
  })
})

test('.update() a document and .open() it on a second node', t => {
  t.plan(1)
  const tmpdir1 = tmp.dirSync({unsafeCleanup: true})
  const hm1 = new HyperMerge({path: tmpdir1.name})
  const tmpdir2 = tmp.dirSync({unsafeCleanup: true})
  const hm2 = new HyperMerge({path: tmpdir2.name})
  hm1.core.ready(() => {
    hm2.core.ready(() => {
      const writableDoc = hm1.create()
      const hex = hm1.getHex(writableDoc)
      const newDoc = Automerge.change(writableDoc, doc => {
        doc.test = 1
      })
      hm1.update(newDoc)
      // Add a slight delay to give the network a chance to update
      setTimeout(() => {
        hm2.open(hex)
        hm2.once('document:updated', () => {
          hm2.once('document:updated', () => {
            const clonedDoc = hm2.open(hex)
            t.deepEqual(clonedDoc.toJS(), {
              _conflicts: {},
              _objectId: '00000000-0000-0000-0000-000000000000',
              test: 1
            })
            hm1.swarm.close()
            hm2.swarm.close()
            tmpdir1.removeCallback()
            tmpdir2.removeCallback()
          })
        })
      }, 1000)
    })
  })
})

test('.fork() a document, make changes, and then .merge() it', t => {
  t.plan(4)
  const tmpdir = tmp.dirSync({unsafeCleanup: true})
  const hm = new HyperMerge({path: tmpdir.name})
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

        // Cleanup
        hm.swarm.close()
        tmpdir.removeCallback()
      })
    })
  })
})

test('.open() on document with dependencies fetches all of them', t => {
  t.plan(5)
  const tmpdir1 = tmp.dirSync({unsafeCleanup: true})
  const hm1 = new HyperMerge({path: tmpdir1.name})
  const tmpdir2 = tmp.dirSync({unsafeCleanup: true})
  const hm2 = new HyperMerge({path: tmpdir2.name})
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

          // Merge back to first document
          hm1.merge(firstActorHex, secondActorHex)
          t.deepEqual(hm1.document(firstActorHex).toJS(), {
            _conflicts: {},
            _objectId: '00000000-0000-0000-0000-000000000000',
            test: 2
          })

          // Add a slight delay to give the network a chance to update
          setTimeout(() => {
            // On second hypermerge, .open() the second document
            hm2.open(secondActorHex)
            hm2.once('document:updated', () => {
              hm2.once('document:updated', () => {
                hm2.once('document:updated', () => {
                  t.deepEqual(hm2.document(secondActorHex).toJS(), {
                    _conflicts: {},
                    _objectId: '00000000-0000-0000-0000-000000000000',
                    test: 2
                  })

                  // Cleanup
                  hm1.swarm.close()
                  hm2.swarm.close()
                  tmpdir1.removeCallback()
                  tmpdir2.removeCallback()
                })
              })
            })
          })
        })
      })
    })
  })
})

// FIXME: Test for .delete(hex)

// FIXME: Test for .openAll()

const test = require('tape')
const {HyperMerge} = require('..')
const tmp = require('tmp')

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
      const hex = writableDoc._actorId
      hm1.on('document:ready', () => {
        const feed = hm1.feed(hex)
        feed.ready(() => {
          t.ok(hm1.isWritable(hex), 'Original doc is writable')
        })
      })
      hm2.document(hex)
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

// FIXME: Test for .isWritable(hex)

// FIXME: Test for .update(doc)

// FIXME: Test for .delete(hex)

// FIXME: Test for .fork(hex)

// FIXME: Test for .merge(hex, hex2)

// FIXME: Test for .open(hex)

// FIXME: Test for .openAll()

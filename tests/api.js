const test = require('tape')
const ram = require('random-access-memory')

const Hypermerge = require('..')
const OnlineOfflinePump = require('./lib/online-offline-pump')

test('setup', t => {
  t.plan(2)

  const hm1 = new Hypermerge({storage: ram})
  t.ok(hm1, 'is truthy')
  hm1.once('ready', merge => {
    t.equal(undefined, merge, 'calls ready')
    t.end()
  })
})

test('write and read a file', t => {
  t.plan(2)

  const hm = new Hypermerge({storage: ram})
  const buffer = new Buffer('test file')

  hm.once('ready', () => {
    hm.writeFile(buffer, (error, hyperfileId) => {
      t.ok(hyperfileId, 'writeFile passes back a hyperfileId')

      hm.fetchFile(hyperfileId, (error, buffer) => {
        t.equal(buffer.toString(), 'test file', 'readFile passes back the file buffer')
        t.end()
      })
    })
  })
})

test('create a new actor and document', t => {
  t.plan(2)
  const hm = new Hypermerge({storage: ram})
  hm.once('ready', () => {
    const doc = hm.create()
    const docHandle = hm.openHandle(hm.getId(doc))

    t.deepEqual(doc, {}, 'expected empty automerge doc')

    docHandle.onChange((d) => {
      t.equal(doc, d)
    })
  })
})

test('.change() a document and listen for changes on a second node', t => {
  t.plan(3)
  t.timeoutAfter(2000)

  const hm1 = new Hypermerge({storage: ram})
  hm1.once('ready', () => {
    hm1.joinSwarm()
    const hm2 = new Hypermerge({storage: ram})
    hm2.once('ready', () => {
      hm2.joinSwarm()
      const pump = new OnlineOfflinePump(hm1, hm2)
      const doc = hm1.create()
      const docId = hm1.getId(doc)
      const docHandle1 = hm1.openHandle(docId)
      const docHandle2 = hm2.openHandle(docId)

      pump.goOnline()

      docHandle1.onChange((d) => {
        t.equal(doc, d, 'onChange passes the current document')
        docHandle1.onChange(() => {})

        docHandle1.change(d => {
          d.test = 1
        })
      })

      docHandle2.onChange((d) => {
        t.equal(d.test, 1, 'changes propogate to docHandle2')
        docHandle2.onChange(() => {})
        docHandle2.change(d => {
          d.test = 2
        })

        docHandle1.onChange((d) => {
          if (d.test === 2) {
            // Intermittently fails because the second change never comes through
            t.pass('changes propogate back to docHandle1')

            hm1.releaseHandle(docHandle1)
            hm2.releaseHandle(docHandle2)
            t.end()
          }
        })
      })
    })
  })
})

test('.fork() a document, make changes, and then .merge() it', t => {
  t.plan(4)

  const hm1 = new Hypermerge({storage: ram})

  hm1.once('ready', () => {
    const doc1 = hm1.create()
    const id1 = hm1.getId(doc1)

    // first change
    hm1.change(doc1, 'First actor makes a change', doc => {
      doc.test = 1
    })

    t.deepEqual(hm1.find(id1), {test: 1}, 'doc1 contains first change after update')

    // Fork to second document
    const doc2 = hm1.fork(id1)
    const id2 = hm1.getId(doc2)

    t.deepEqual(hm1.find(id2), {test: 1}, 'doc2 contains first change after fork')

    hm1.change(doc2, 'Second actor makes a change', doc => {
      doc.test = 2
    })

    t.deepEqual(hm1.find(id2), {test: 2}, 'doc2 contains second change')

    // Merge back to first document
    hm1.merge(id1, id2)

    t.deepEqual(hm1.find(id1), {test: 2}, 'doc1 contains second change after merge')

    t.end()
  })
})

test.onFinish(() => process.exit(0))

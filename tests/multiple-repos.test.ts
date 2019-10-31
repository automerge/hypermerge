import test from 'tape'
import { expectDocs, testRepo, testSwarm, generateServerPath, testDiscoveryId } from './misc'
import * as Stream from '../src/StreamLogic'

test('Share a doc between two repos', (t) => {
  t.plan(0)

  const repoA = testRepo()
  const repoB = testRepo()
  ;(global as any).repoA = repoA
  ;(global as any).repoB = repoB

  repoA.setSwarm(testSwarm())
  repoB.setSwarm(testSwarm())

  const id = repoA.create({ a: 1 })

  repoB.change<any>(id, (doc: any) => {
    doc.b = 2
  })

  repoA.watch<any>(
    id,
    expectDocs(t, [
      [{ a: 1 }, 'repoA has the initial doc'],
      [{ a: 1, b: 2 }, 'repoA gets change from repoB'],
    ])
  )

  repoB.watch<any>(
    id,
    expectDocs(t, [[{ a: 1, b: 2 }, "repoB gets repoA's change and its local changes at once"]])
  )

  test.onFinish(() => {
    t.comment('Tests are finished')

    repoA.close()
    repoB.close()
  })
})

test("Three way docs don't load until all changes are in", (t) => {
  t.plan(1)

  const repoA = testRepo()
  const repoB = testRepo()
  const repoC = testRepo()

  repoA.setSwarm(testSwarm())
  repoB.setSwarm(testSwarm())

  // connect repos A and B

  const id = repoA.create({ a: 1 })

  repoB.change<any>(id, (doc: any) => {
    doc.b = 2
  })

  repoA.watch<any>(
    id,
    expectDocs(t, [
      [{ a: 1 }, 'repoA should have create(doc)'],
      [{ a: 1, b: 2 }, "repoA should have repoB's change"],
    ])
  )

  repoB.watch<any>(
    id,
    expectDocs(t, [
      [
        { a: 1, b: 2 },
        "repoB gets repoA's change and its local changes at once",
        () => {
          repoC.setSwarm(testSwarm())

          repoC.doc(id, (doc) => {
            t.deepEqual(doc, { a: 1, b: 2 }, "repoC gets repoA's and repoB's changes")
          })
        },
      ],
    ])
  )

  test.onFinish(() => {
    t.comment('Tests are finished')

    repoA.close()
    repoB.close()
    repoC.close()
  })
})

test('Message about a doc between two repos', (t) => {
  t.plan(1)
  const repoA = testRepo()
  const repoB = testRepo()

  repoA.setSwarm(testSwarm())
  repoB.setSwarm(testSwarm())

  // connect the repos

  const id = repoA.create({ irrelevant: 'data' })

  // XXX: names
  const expectedMessage = { hello: 'world' }

  const handle = repoB.open(id)
  handle.subscribeMessage((message) => {
    t.deepEqual(message, expectedMessage)
  })
  setTimeout(() => repoA.message(id, expectedMessage), 1000)

  test.onFinish(() => {
    t.comment('Tests are finished')

    repoA.close()
    repoB.close()
  })
})

test('Share a file between two repos', async (t) => {
  t.plan(2)

  const repoA = testRepo()
  const repoB = testRepo()
  repoA.startFileServer(generateServerPath())
  repoB.startFileServer(generateServerPath())
  repoA.setSwarm(testSwarm())
  repoB.setSwarm(testSwarm())

  const discoveryId = testDiscoveryId()
  repoA.back.network.join(discoveryId)
  repoB.back.network.join(discoveryId)

  const pseudoFile = Buffer.alloc(1024 * 1024, 1)
  const { url } = await repoA.files.write(Stream.fromBuffer(pseudoFile), 'application/octet-stream')

  const [header, readable] = await repoB.files.read(url)
  const content = await Stream.toBuffer(readable)
  t.equal(header.mimeType, 'application/octet-stream')
  t.equal(content.equals(pseudoFile), true)
  repoA.close()
  repoB.close()
})

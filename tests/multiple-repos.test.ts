import test from 'tape'
import { expectDocs, testRepo, testSwarm } from './misc'

test('Share a doc between two repos', (t) => {
  t.plan(0)

  const repoA = testRepo()
  const repoB = testRepo()

  repoA.setSwarm(testSwarm())
  repoB.setSwarm(testSwarm())

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
    console.log('received message', message)
    t.deepEqual(message, expectedMessage)
  })
  setTimeout(() => repoA.message(id, expectedMessage), 1000)

  test.onFinish(() => {
    t.comment('Tests are finished')

    repoA.close()
    repoB.close()
  })
})

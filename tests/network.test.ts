import test from 'tape'
import { Repo } from '../src'
import Client from 'discovery-cloud-client'
import { expectDocs } from './misc'

const ram: Function = require('random-access-memory')

test('Share a doc between two repos', (t) => {
  t.plan(0)

  const repoA = new Repo({ storage: ram })
  const repoB = new Repo({ storage: ram })

  const clientA = new Client({
    id: repoA.id,
    stream: repoA.stream,
    url: 'wss://discovery-cloud.herokuapp.com',
  })

  const clientB = new Client({
    id: repoB.id,
    stream: repoB.stream,
    url: 'wss://discovery-cloud.herokuapp.com',
  })

  repoA.replicate(clientA)
  repoB.replicate(clientB)

  // connect the repos

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

test("Three way docs don't load until all canges are in", (t) => {
  t.plan(1)

  const repoA = new Repo({ storage: ram })
  const repoB = new Repo({ storage: ram })
  const repoC = new Repo({ storage: ram })

  const clientA = new Client({
    id: repoA.id,
    stream: repoA.stream,
    url: 'wss://discovery-cloud.herokuapp.com',
  })

  const clientB = new Client({
    id: repoB.id,
    stream: repoB.stream,
    url: 'wss://discovery-cloud.herokuapp.com',
  })

  const clientC = new Client({
    id: repoC.id,
    stream: repoC.stream,
    url: 'wss://discovery-cloud.herokuapp.com',
  })

  repoA.replicate(clientA)
  repoB.replicate(clientB)

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
          repoC.replicate(clientC)
          repoC.doc(id, (doc) => {
            t.deepEqual(doc, { a: 1, b: 2 })
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
  const repoA = new Repo({ storage: ram })
  const repoB = new Repo({ storage: ram })

  const clientA = new Client({
    id: repoA.id,
    stream: repoA.stream,
    url: 'wss://discovery-cloud.herokuapp.com',
  })

  const clientB = new Client({
    id: repoB.id,
    stream: repoB.stream,
    url: 'wss://discovery-cloud.herokuapp.com',
  })

  repoA.replicate(clientA)
  repoB.replicate(clientB)

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

/*
function expectDocs(t: test.Test, docs: [any, string][]) {
  let i = 0

  // add to the current planned test length:
  t.plan((<any>t)._plan + docs.length)

  return (doc: any) => {
    const tmp = docs[i++]
    if (tmp === undefined) {
      t.fail(`extrac doc emitted ${JSON.stringify(doc)}`)
    } else {
      const [expected, msg] = tmp
      t.deepEqual(doc, expected, msg)
    }
  }
}
*/

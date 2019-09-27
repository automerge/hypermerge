import test from 'tape'
import { Repo } from '../src'
import Hyperswarm from 'hyperswarm'
import { expectDocs, generateServerPath } from './misc'
import { streamToBuffer, bufferToStream } from '../src/Misc'

const ram: Function = require('random-access-memory')

test('Writing and reading files works', async (t) => {
  t.plan(1)
  const repoA = new Repo({
    storage: ram,
  })
  repoA.startFileServer(generateServerPath())
  const pseudoFile = Buffer.from('coolcool')
  const size = pseudoFile.length
  const url = await repoA.files.write(bufferToStream(pseudoFile), size, 'application/octet-stream')
  const [readable, mimeType] = await repoA.files.read(url)
  const buffer = await streamToBuffer(readable)
  t.equal(pseudoFile.toString(), buffer.toString())
  repoA.close()
})

test('Share a doc between two repos', (t) => {
  t.plan(0)

  const repoA = new Repo({ storage: ram })
  const repoB = new Repo({ storage: ram })

  repoA.setSwarm(createSwarm(repoA), { announce: true, lookup: true })
  repoB.setSwarm(createSwarm(repoB), { announce: true, lookup: true })

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

test("Three way docs don't load until all changes are in", (t) => {
  t.plan(1)

  const repoA = new Repo({ storage: ram })
  const repoB = new Repo({ storage: ram })
  const repoC = new Repo({ storage: ram })

  repoA.setSwarm(createSwarm(repoA))
  repoB.setSwarm(createSwarm(repoB))

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
          repoC.setSwarm(createSwarm(repoC))

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

  repoA.setSwarm(createSwarm(repoA))
  repoB.setSwarm(createSwarm(repoB))

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

function createSwarm(_repo: Repo) {
  // return new Client({
  //   id: repo.id,
  //   stream: repo.stream,
  //   url: 'wss://discovery-cloud.herokuapp.com',
  // })

  return Hyperswarm()
}

import test from 'tape'
import { Repo } from '../src'
import Client from 'discovery-cloud-client'
import { expectDocs } from './misc'

const ram: Function = require('random-access-memory')

const cycles = 100

test(`Create ${cycles} docs and share one`, (t) => {
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

  repoA.setSwarm(clientA)
  repoB.setSwarm(clientB)

  // connect the repos

  Array.from({ length: cycles }, () => 0).forEach(() => {
    repoA.create({ test: 'a' })
    repoB.create({ test: 'b' })
  })
  const url = repoA.create({ a: 1 })

  repoB.change<any>(url, (doc: any) => {
    doc.b = 2
  })

  repoA.watch<any>(
    url,
    expectDocs(t, [
      [{ a: 1 }, 'repoA should have create(doc)'],
      [{ a: 1, b: 2 }, "repoA should have repoB's change"],
    ])
  )

  repoB.watch<any>(
    url,
    expectDocs(t, [[{ a: 1, b: 2 }, "repoB gets repoA's change and its local changes at once"]])
  )

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

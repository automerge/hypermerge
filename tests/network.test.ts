import test from "tape";
import { Repo } from "../src"
import Client from 'discovery-cloud-client'

const ram: Function = require("random-access-memory")

test("Share a doc between two repos", t => {
  t.plan(0)

  const repoA = new Repo({ storage: ram })
  const repoB = new Repo({ storage: ram })

  const clientA = new Client({
    id: repoA.id,
    stream: repoA.stream,
    url: "wss://discovery-cloud.herokuapp.com",
  })

  const clientB = new Client({
    id: repoB.id,
    stream: repoB.stream,
    url: "wss://discovery-cloud.herokuapp.com",
  })

  repoA.replicate(clientA)
  repoB.replicate(clientB)

  // connect the repos

  const id = repoA.create({ a: 1 })

  repoB.change(id, doc => {
    doc.b = 2
  })

  const handleA = repoA.open(id).subscribe(expectDocs(t, [
    [{ a: 1 }, "repoA should have create(doc)"],
    [{ a: 1, b: 2 }, "repoA should have repoB's change"],
  ]))

  const handleB = repoB.open(id).subscribe(expectDocs(t, [
    [{}, "starts as an empty doc after open"], // not sure we want this
    [{ b: 2 }, "repoB gets repoB's change"],
    [{ b: 2 }, "repoB gets repoB's change again"], // probably shouldn't emit twice
    [{ a: 1, b: 2 }, "repoB gets repoA's change"],
  ]))

  test.onFinish(() => {
    t.comment("Tests are finished")
    handleA.close()
    handleB.close()

    // Attempting to close down the repos after we're done:
    clientA.discovery.close()
    clientB.discovery.close()
    clientA.peers.forEach(p => p.connections.forEach(con => con.destroy()))
    clientB.peers.forEach(p => p.connections.forEach(con => con.destroy()))
    clientA.removeAllListeners()
    clientB.removeAllListeners()
  })
})


function expectDocs(t: test.Test, docs: [any, string][]) {
  let i = 0

  // add to the current planned test length:
  t.plan((<any>t)._plan + docs.length)

  return (doc: any) => {
    const [expected, msg] = docs[i++]
    t.deepEqual(doc, expected, msg)
  }
}

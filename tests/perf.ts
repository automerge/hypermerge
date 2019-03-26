import test from "tape"
import { Repo } from "../src"
import Client from "discovery-cloud-client"
import { expectDocs } from "./misc"

const ram: Function = require("random-access-memory")

const cycles = 100

test(`Create ${cycles} docs and share one`, t => {
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

  Array.from({ length: cycles }, () => 0).forEach(() => {
    repoA.create({ test: "a" })
    repoB.create({ test: "b" })
  })
  const url = repoA.create({ a: 1 })

  repoB.change<any>(url, doc => {
    doc.b = 2
  })

  repoA.watch<any>(
    url,
    expectDocs(t, [
      [{ a: 1 }, "repoA should have create(doc)"],
      [{ a: 1, b: 2 }, "repoA should have repoB's change"],
    ]),
  )

  repoB.watch<any>(
    url,
    expectDocs(t, [
      [
        { a: 1, b: 2 },
        "repoB gets repoA's change and its local changes at once",
      ],
    ]),
  )

  test.onFinish(() => {
    t.comment("Tests are finished")

    repoA.close()
    repoB.close()
  })
})

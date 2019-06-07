import test from "tape";
import { Repo, RepoBackend, RepoFrontend } from "../src"
import { expectDocs } from "./misc"

const ram: Function = require("random-access-memory")


interface Foo {
  foo?: string
  bar?: string
}

test("Simple create doc and make a change", (t) => {
  const repo = new Repo<Foo>({ storage: ram })
  const url = repo.create()
  repo.watch(url,
    expectDocs(t, [
      [{}, "blank started doc"],
      [{ foo: "bar" }, "change preview"],
      [{ foo: "bar" }, "change final"],
    ])
  )
  repo.change(url, state => {
    state.foo = "bar"
  })
});

test("Create a doc backend - then wire it up to a frontend - make a change", (t) => {
  const back = new RepoBackend<Foo>({ storage: ram })
  const front = new RepoFrontend<Foo>()
  back.subscribe(front.receive)
  front.subscribe(back.receive)
  const url = front.create()
  front.watch(url,
    expectDocs(t, [
      [{}, "blank started doc"],
      [{ foo: "bar" }, "change preview"],
      [{ foo: "bar" }, "change final"],
    ])
  )
  front.change(url, state => {
    state.foo = "bar"
  })
  test.onFinish(() => front.close())
})

test("Test document forking...", (t) => {
  t.plan(0)
  const repo = new Repo<Foo>({ storage: ram })
  const id = repo.create({ foo: "bar" })
  repo.watch(id,
    expectDocs(t, [
      [{ foo: "bar" }, "init val"],
    ])
  )
  const id2 = repo.fork(id)
  repo.watch(id2,
    expectDocs(t, [
      [{}, "hmm"],
      [{ foo: "bar" }, "init val", () => { repo.change(id2, state => { state.bar = "foo" }) }],
      [{ foo: "bar", "bar": "foo" }, "changed val"],
      [{ foo: "bar", "bar": "foo" }, "changed val echo"],
    ])
  )
  test.onFinish(() => repo.close())
})

test("Test materialize...", (t) => {
  t.plan(1)
  const repo = new Repo<Foo>({ storage: ram })
  const url = repo.create({ foo: "bar0" })
  repo.watch(url,
    expectDocs(t, [
      [{ foo: "bar0" }, "init val"],
      [{ foo: "bar1" }, "changed val"],
      [{ foo: "bar1" }, "changed val echo"],
      [{ foo: "bar2" }, "changed val"],
      [{ foo: "bar2" }, "changed val echo"],
      [{ foo: "bar3" }, "changed val"],
      [{ foo: "bar3" }, "changed val echo", () => {
        repo.materialize(url, 2, state => {
          t.equal(state.foo, "bar1")
        })
      }],
    ])
  )
  repo.change(url, state => {
    state.foo = "bar1"
  })
  repo.change(url, state => {
    state.foo = "bar2"
  })
  repo.change(url, state => {
    state.foo = "bar3"
  })
  test.onFinish(() => repo.close())
})

test("Test meta...", (t) => {
  t.plan(2)
  const repo = new Repo<Foo>({ storage: ram })
  const id = repo.create({ foo: "bar0" })
  repo.watch(id, (state, clock, index) => {
    repo.meta(id, meta => {
      if (meta && meta.type === "Document") {
        if (index === 1) {
          const actor = meta.actor!
          const seq = meta.clock[actor]
          t.equal(seq, 3)
        }
        if (index === 3) {
          const actor = meta.actor!
          const seq = meta.clock[actor]
          t.equal(seq, 3)
          t.end();
        }
      }
    })
  })

  repo.change(id, state => {
    state.foo = "bar1"
  })

  repo.change(id, state => {
    state.foo = "bar2"
  })

  test.onFinish(() => repo.close())
})

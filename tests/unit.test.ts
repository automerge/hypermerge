import test from "tape";
import { Repo, RepoBackend, RepoFrontend } from "../src"

const ram: Function = require("random-access-memory")

test("Simple create doc and make a change", (t) => {
  const repo = new Repo({ storage: ram })
  const id = repo.create()
  const handle = repo.open(id)
  handle.subscribe((state, _clock, index) => {
    switch (index) {
      case 0:
        t.equal(state.foo, undefined)
        break
      case 1:
        t.equal(state.foo, "bar")
        break
      case 2:
        t.equal(state.foo, "bar")
        t.end();
        handle.close()
    }
  })
  handle.change(state => {
    state.foo = "bar"
  })
});

test("Create a doc backend - then wire it up to a frontend - make a change", (t) => {
  const back = new RepoBackend({ storage: ram })
  const front = new RepoFrontend()
  back.subscribe(front.receive)
  front.subscribe(back.receive)
  const id = front.create()
  const handle = front.open(id)
  handle.subscribe((state, _clock, index) => {
    switch (index) {
      case 0:
        t.equal(state.foo, undefined)
        break
      case 1:
        t.equal(state.foo, "bar")
        break
      case 2:
        t.equal(state.foo, "bar")
        t.end();
        handle.close()
    }
  })
  handle.change(state => {
    state.foo = "bar"
  })
})

test("Test document forking...", (t) => {
  const repo = new Repo({ storage: ram })
  const id = repo.create()
  const handle = repo.open(id)
  handle.subscribe((state, clock, index) => {
    switch (index) {
      case 0:
        t.equal(state.foo, undefined)
        break
    }
  })
  handle.change(state => {
    state.foo = "bar"
  })
  const id2 = handle.fork()
  const handle2 = repo.open(id2)
  handle2.subscribe((state, clock, index) => {
    switch (index) {
      case 1:
        t.equal(state.foo, "bar")
        handle2.change(state => { state.bar = "foo" })
        break
      case 3:
        t.equal(state.bar, "foo")
        t.end()
        break;
    }
  })
})

test("Test materialize...", (t) => {
  const repo = new Repo({ storage: ram })
  const id = repo.create({ foo: "bar0" })
  let _clock = {}
  const handle = repo.watch<any>(id, (state,clock,index) => {
    //console.log("INDEX=",index, state)
    if (index === 1) {
      t.equal(state.foo, "bar1")
      _clock = clock!
    }
    if (index === 5) {
      t.equal(state.foo, "bar3")
      repo.materialize<any>(_clock, (state) => {
        t.equal(state.foo, "bar1")
        t.end()
      })
    }
  })
  repo.change(id, state => {
    state.foo = "bar1"
  })
  repo.change(id, state => {
    state.foo = "bar2"
  })
  repo.change(id, state => {
    state.foo = "bar3"
  })
})

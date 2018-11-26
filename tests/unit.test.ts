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

/*
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
        t.end()
        break
    }
  })
})
*/

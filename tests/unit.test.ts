import test from "tape";
import { Repo, Document, keyPair } from "../src"

test("Simple create doc and make a change", (t) => {
  const repo = new Repo()
  const doc = repo.createDocument()
  const handle = doc.handle()
  handle.subscribe((state, index) => {
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
  const keys = keyPair()
  const repo = new Repo()
  const backend = repo.createDocumentBackend(keys)
  const doc = new Document(keys)

  doc.subscribe(backend.receive)
  backend.subscribe(doc.receive)

  const handle = doc.handle()
  handle.subscribe((state, index) => {
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

import test from "tape";
import { Repo, Document, keyPair } from "../src"
import { RepoFrontend } from "../src/RepoFrontend"

test("Simple create doc and make a change", (t) => {
  const repoB = new Repo()
  const repoF = new RepoFrontend()
  repoB.subscribe(repoF.receive)
  repoF.subscribe(repoB.receive)
  const id = repoF.create()
  console.log("ID=",id)
  const handle = repoF.open(id)
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
  t.end();
/*
  const keys = keyPair()
  const repo = new Repo()
  const backend = repo.createDocumentBackend(keys)
  const doc = new Document(keys)

//  doc.subscribe(backend.receive)
//  backend.subscribe(doc.receive)

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
*/
})

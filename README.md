# Hypermerge

Hypermerge a proof of concept library for using the hypercore / hyperprotocol
tools from the DAT ecosystem to enable peer to peer communication between
automerge data stores.

If successful this project would provide a way to have apps data sets that are
conflict free and offline first (thanks to CRDT's) and serverless (thanks to
hypercore/DAT).

While the DAT community has done a lot of work to secure their tool set, zero
effort has been made with hypermerge itself to deal with security and privacy
concerns.  Due to the secure nature of the tools its built upon a properly
audited and secure version of this library would be possible in the future.

## How it works

## Concepts

The base object you make with hypermerge is a Repo.  A repo is responsible for
managing documents and replicating to peers.

### Basic Setup (Serverless or with a Server)

```ts
import { Repo } from "hypermerge"

const storage = require("random-access-file")
const path = ".data"

const repo = new Repo({ path, storage })

// DAT's discovery swarm or truly serverless discovery
const DiscoverySwarm = require("discovery-swarm");
const defaults = require('dat-swarm-defaults')
const discovery = new DiscoverySwarm(defaults({stream: repo.stream, id: repo.id }));

repo.replicate(discovery)
```

### Create / Edit / View / Delete a document

```ts

  const url = repo.create({ hello: "world" })

  repo.doc<any>(url, (doc) => {
    console.log(doc) // { hello: "world" }
  })

  // this is an automerge change function - see automerge for more info
  // basically you get to treat the state as a plain old javacript object
  // operations you make will be added to an internal append only log and
  // replicated to peers

  repo.change(url, (state:any) => {
    state.foo = "bar"
  })

  repo.doc<any>(url, (doc) => {
    console.log(doc) // { hello: "world", foo: "bar" }
  })

  // to watch a document that changes over time ...
  const handle = repo.watch(url, (doc:any) => {
    console.log(doc)
    if (doc.foo === "bar") {
      handle.close()
    }
  })
```

### Two repos on different machines

```ts

const docUrl = repoA.create({ numbers: [ 2,3,4 ]})

// this will block until the state has replicated to machine B

repoA.watch<MyDoc>(docUrl, state => {
  console.log("RepoA", state)
  // { numbers: [2,3,4] } 
  // { numbers: [2,3,4,5], foo: "bar" }
  // { numbers: [2,3,4,5], foo: "bar" } // (local changes repeat)
  // { numbers: [1,2,3,4,5], foo: "bar", bar: "foo" }
})

repoB.watch<MyDoc>(docUrl, state => {
  console.log("RepoB", state)
  // { numbers: [1,2,3,4,5], foo: "bar", bar: "foo" }
})


repoA.change<MyDoc>(docUrl, (state) => {
  state.numbers.push(5)
  state.foo = "bar"
})

repoB.change<MyDoc>(docUrl, (state) => {
  state.numbers.unshift(1)
  state.bar = "foo"
})

```

### Accessing Files

```ts
```


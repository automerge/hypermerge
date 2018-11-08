# Hypermerge

Hypermerge is a Node.js library for building p2p collaborative applications
without any server infrastructure.  It combines Automerge, a CRDT,
with hypercore, a distributed append-only log.

## Concepts

### Repo

A repo manages a collection of automerge documents.  It's two primary functions are `create` and `open`

```ts
  const id = repo.create()
  const handle = repo.open(id)
```

Repo's can be split in to frontend and backend if you dont want the documents
and the database (network,io,compute) in the same thread.  The backend portion
has a `replicate` for replicating data with peers

### Handle

A handle gives you access to the document.  It has 4 functions.  The functions
`subscribe` and `once` can be used to access the documents changing state (or
get it once and close the handle).  Note a handle can only have one subsciber -
need more, open another handle.  The state provided by the handle is an `automerge`
document.

The `change` function gives you access to an editable version of the state.

Lastly a close function to destroy the handle when you're done.

```
  const handle = repo.open(id)
  handle.subscribe( state => { ... } )
  // or
  handle.once( state => { ... } )
  handle.change( state => {
    state.foo = "bar"
  })
  handle.close()
```

## Simple Example

In this exaple you open a document repo (backed by random access memory - but
you can use any storage type here)

A document is created.  A handle to the document is opened and used to
subscribe to state updates and make changes.

```ts
  import { Repo } from "hypermerge"

  const ram: Function = require("random-access-memory")

  const repo = new Repo({ storage: ram })
  const id = repo.create()
  const handle = repo.open(id)
  handle.subscribe((state) => {
    console.log("document state is", state)
  })
  handle.change(state => {
    state.foo = "bar"
  })
  handle.change(state => {
    state.bar = "baz"
  })
```

## Back Front Split Example

  Often times you wont want your database running in your render thread so it
is possible to have the database, io and networking all in one thread and the
change and update api in another.  To wire this up do the following.  In a real
scenario you might have a socket or pipe in between the two halves.

```ts
  import { RepoFrontend, RepoBackend } from "hypermerge"

  const ram: Function = require("random-access-memory")

  const repo = new RepoFrontend()
  const back = new RepoBackend({ storage: ram })

  repo.subscribe(back.receive)
  back.subscribe(repo.receive)

  const handle = repo.open(id)
  handle.subscribe((state) => {
    console.log("document state is", state)
  })
  handle.change(state => {
    state.foo = "bar"
  })
  handle.change(state => {
    state.bar = "baz"
  })
```

Networking

  To replicate a hypermerge documents with peers plug in a discovery swarm
interface to the replicate() function on the Repo (or the RepoBackend)

See:
[Discovery Swarm](https://github.com/mafintosh/discovery-swarm)
[Discovery Cloud](https://github.com/orionz/discovery-cloud-client)

```ts
  import { Repo } from "hypermerge"

  import { Client } from "discovery-cloud-client"

  const ram: Function = require("random-access-memory")

  const repo = new Repo({ storage: ram })

  const discovery = new Client({
    url: "wss://discovery-cloud.herokuapp.com",
    id: repo.id,
    stream: repo.stream,
  })

  repo.replicate(discovery)
```



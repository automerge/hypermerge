# Hypermerge

Hypermerge is a high-level API for building collaborative document editing experiences over peer-to-peer networks.

It is built on top of the [Automerge](https://github.com/automerge/automerge) data structure and the [Hypercore](https://github.com/mafintosh/hypercore) distributed append-only log from the [Dat project](https://datproject.org/).

Automerge is a new Conflict-Free Replicated Data Type
  ([CRDT](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)). It is based on [academic research on JSON CRDTs](https://arxiv.org/abs/1608.03960) (but some details are different from the paper).

It uses the the [multicore](README-multicore.md) library to manage many hypercores that can be replicated.

## Synopsis

``` js
alice, bob, and chuck want to work on a document together

// initial creation
// storage is a directory where all the bits land
var mydoc = hyperdoc(archiver, {identity: myIdentity()})

view = mydoc.view()

var writer = mydoc.writer()
// -> the hypercore feed public key
view.change((doc) => {
    doc.title = "AWESOME DRAWING!!!!!!!"
    doc.pixels[0][0] = 'REALLY RED'
})

mydoc.listSessions() // [writableSession('Jim')]

mydoc.id // -> 'deadb33fc0dedeafd00ddeadb33fc0dedeafd00d'
mydoc.join() // post to a hash of ^^^^ in the DHT

///////////////////// MEANWHILE ON CYBERTRON /////////////////

// get a hyperdoc share id somehow
share_id = 'deadb33fc0dedeafd00ddeadb33fc0dedeafd00d'

var otherdoc = hyperdoc(storage, share_id) // since we're loading one?
otherdoc.join() // this populates the feeds
otherdoc.listSessions() // [writableSession('Peter'), session('Jim')]

render(otherDoc.view()) // this looks really cool

// .... later
writer.id // -> the hypercore feed public key
// this gets broadcast via the 
view.change(writer, (doc) => {
    doc.pixels[1][1] = 'RESPLENDENT GREEN'
})

//////////////////////// LATER ///////////////////////
// restricted views 
// (right now we render everything we can get our hands on)
jimpeterView = mydoc.view(Peter, Jim) // but not jeff

// multiple local writers
writer.

// fork this doc: my writes stop propagating, 
//                i stop pulling in others' writes
forkDoc.fork() // return same doc with different mydoc.id

// time travel
mydoc.viewAsOf([some old vector clock?])
```

## Concepts

### Room

### View

### Cursor

### Session

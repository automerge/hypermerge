# Hypermerge

Hypermerge is a secure, real-time distributed JSON-like data store that can be modified concurrently by different users, and merged again automatically.

It is built on top of the [Automerge](https://github.com/automerge/automerge) data structure and the [Hypercore](https://github.com/mafintosh/hypercore) distributed append-only log from the [Dat project](https://datproject.org/).

Automerge is a new Conflict-Free Replicated Data Type
  ([CRDT](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)). It is based on [academic research on JSON CRDTs](https://arxiv.org/abs/1608.03960) (but some details are different from the paper).

``` sh
npm install --save hypermerge
```

## Features

* JSON-like data structure, ideal for application data stores
* easy peer-to-peer networking
* real-time subscriptions
* multiple writers on multiple devices
* automatic syncing and merging
* offline support
* intelligent handling of conflicts, automatic resolution
* can run entirely in memory
* optionally, storage can be persisted to disk

## Usage

Here is a simple distributed "To do" list implemented in Node.js, with a similar model to what you'd find in a [TodoMVC](http://todomvc.com/) example...

On the first (source) computer:

``` js
const hypermerge = require('hypermerge')
const hyperdiscovery = require('hyperdiscovery')

// Create a "source" hypermerge
const hm = hypermerge()

hm.on('ready', () => {
  // Display the public key that other nodes will use to connect
  console.log('Key:', hm.key.toString('hex'))

  // Advertise the hypermerge to the Internet to find and connect to peers
  const sw = hyperdiscovery(hm)
  console.log('Waiting for connections...')
  sw.on('connection', peer => {
    console.log('connected to', sw.connections.length, 'peers')
    // When the second computer connects, it will pass a key for the
    // hypercore that it will write it's changes to as 'userData'
    const remotePeerKey = peer.remoteUserData.toString()
    // Clone existing changes from second computer and incorporate into
    // our Automerge document. Also listen for new changes.
    hm.connectPeer(remotePeerKey)
  })

  // Write some data to our Automerge document
  hm.change(doc => {
    doc.todos = []
    doc.todos.push({id: 1, title: 'Read JSON CRDT paper', done: false})
  })
  console.log('Initial todos:\n', hm.get().todos)

  // When our Automerge document is updated, display the todos
  hm.doc.registerHandler(doc => {
    console.log('Doc changed:\n', doc.todos)
    sw.close() // All done, close swarm and exit
  })
})
```

On the remote, second computer:

``` js
const hypermerge = require('hypermerge')
const hyperdiscovery = require('hyperdiscovery')

// Create a "local" hypermerge using the key of the "source" hypermerge
// (running on the first computer)
const key = process.argv[2]
if (!key) {
  console.error('Need a key!')
  process.exit(1)
}

const opts = {key}
const hm = hypermerge(opts) // This is different than on the first
 // computer, as we are passing in the key of the source hypermerge

hm.on('ready', () => {
  // Talk to the internet to find and connect to peers that
  // have the key we are interested in
  const sw = hyperdiscovery(hm, {
    // Somehow, the source needs to know the key for our local writable
    // feed so it can subscribe to it. One way to do that is to pass
    // back the key in the "userData" when we make a network connection.
    stream: () => hm.replicate({userData: hm.local.key.toString('hex')})
  })

  sw.on('connection', peer => {
    console.log('connected to', sw.connections.length, 'peers')
  })

  // Wait for first change to arrive, then update
  let updated = false
  hm.doc.registerHandler(update)

  function update () {
    if (!updated) {
      updated = true

      console.log('Before:\n', hm.get().todos)

      // Change the todo list item to be 'done'
      hm.change(doc => {
        doc.todos[0].done = true
      })

      console.log('After marking first todo as "done":\n', hm.get().todos)

      // This is just an example, there is nothing more to do.
      // (wait a second to allow reply to be sent)
      setTimeout(() => { process.exit(0) }, 1000)
    }
  }
})
```

## API

## LICENSE

MIT

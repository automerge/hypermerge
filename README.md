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
  sw.on('connection', {
    console.log('connected to', sw.connections.length, 'peers')
  })

  // Write some data to our document
  hm.change(doc => {
    doc.todos = []
    doc.todos.push({
      id: 1,
      title: 'Read the JSON CRDT paper',
      done: false
    })
  })

  // Watch for changes
  hm.doc.registerHandler(doc => {
    console.log('Doc changed:')
    console.log(doc)
  })
})
```

On the remote, second computer:

``` js
const hypermerge = require('hypermerge')
const hyperdiscovery = require('hyperdiscovery')

// Create a "local" hypermerge using the key of the "source" hypermerge (running on the first computer)
const key = process.argv[2]
if (!key) {
  console.error('Need a key!')
  process.exit(1)
}
const opts = {
  key: key
}
const hm = hypermerge(opts) // This is different than on the first computer, as we are passing in the key of the source hypermerge

hm.on('ready', () => {
  // Talk to the Internet to find and connect to peers that have the key we are interested in
  const sw = hyperdiscovery(hm)
  sw.on('connection', {
    console.log('connected to', sw.connections.length, 'peers')
  })

  // Wait for first change to arrive, then update
  hm.doc.registerHandler(update)

  function update () {
    hm.change(doc => {
      doc.todos[0].done = true
      console.log('Task completed')

      // Don't listen anymore. Don't exit immediately in order to give network some time to send the update back to the other node
      hm.doc.unregisterHandler(update)
      setTimeout(() => process.exit(0), 5000)
    })
  }
})
```

## API

## LICENSE

MIT

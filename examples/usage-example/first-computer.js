const {hypermergeMicro} = require('../..')
const hyperdiscovery = require('hyperdiscovery')

// Create a "source" hypermerge
const hm = hypermergeMicro()

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

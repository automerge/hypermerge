const hypermerge = require('../..')
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
    const remotePeerKey = peer.remoteUserData.toString()
    hm.connectPeer(remotePeerKey)
  })

  // Write some data to our document using Automerge
  hm.change(doc => {
    doc.todos = []
    doc.todos.push({
      id: 1,
      title: 'Read the JSON CRDT paper',
      done: false
    })
  })
  console.log('Initial todos:\n', hm.get().todos)

  // Watch for changes
  hm.doc.registerHandler(doc => {
    console.log('Doc changed:\n', doc.todos)
    sw.close() // All done, close swarm and exit
  })
})

const {hypermergeMicro} = require('../..')
const hyperdiscovery = require('hyperdiscovery')

// Create a "local" hypermerge using the key of the "source" hypermerge
// (running on the first computer)
const key = process.argv[2]
if (!key) {
  console.error('Need a key!')
  process.exit(1)
}

const opts = {key}
const hm = hypermergeMicro(opts) // This is different than on the first
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

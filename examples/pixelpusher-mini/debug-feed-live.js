const hypercore = require('hypercore')
const ram = require('random-access-memory')
const hyperdiscovery = require('hyperdiscovery')
const prettyHash = require('pretty-hash')
const input = require('diffy/input')()

const key = process.argv[2]
if (!key) {
  console.error('Need key')
  process.exit(1)
}
console.log('Key', key)
const feed = hypercore(ram, key)
const sw = hyperdiscovery(feed)
sw.on('connection', () => { console.log('Connection') })
feed.on('ready', () => {
  console.log('Discovery Key', feed.discoveryKey.toString('hex'))
  console.log('Ready', feed.length)
  feed.on('sync', () => {
    console.log('sync', feed.length)
    onSync()
  })
  feed.on('append', () => { console.log('append', feed.length) })
})

function onSync () {
  printChanges(0, done)

  function printChanges (from, cb) {
    if (from >= feed.length) return cb()
    feed.get(from, (err, data) => {
      if (err) {
        console.error('Error', err)
        process.exit(1)
      }
      console.log(from, data.toString())
      printChanges(from + 1, cb)
    })
  }
}

function done () {
  console.log('Done.')
  // process.exit()
}

input.on('keypress', (ch, key) => {
  if (key.sequence === 'c') {
    console.log('Swarm connections', sw.connections.length)
    for (let connection of sw.connections) {
      console.log(`  remoteId: ${prettyHash(connection.remoteId)} ` +
                  `(${connection.feeds.length} feeds)`)
      for (let feed of connection.feeds) {
        console.log(`    ${prettyHash(feed.key)} ` +
                    `(dk: ${prettyHash(feed.discoveryKey)})`)
      }
    }
  } else if (key.sequence === 'C') {
    console.log('Swarm connections', sw.connections)
  } else if (key.sequence === 'p') {
    console.log('Peers', feed.peers.length)
    for (let peer of feed.peers) {
      console.log(`  remoteId: ${prettyHash(peer.remoteId)}`)
    }
  } else if (key.sequence === 'P') {
    console.log('Peers', feed.peers)
  } else if (key.sequence === 'x') {
    console.log('sw._peersIds', sw._peersIds)
  } else if (key.name === 'return') {
    console.log('')
  } else {
    console.log('key', key)
  }
})

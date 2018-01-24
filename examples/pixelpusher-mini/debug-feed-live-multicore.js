const Multicore = require('../../multicore')
const ram = require('random-access-memory')
const prettyHash = require('pretty-hash')
const input = require('diffy/input')()

const key = process.argv[2]
if (!key) {
  console.error('Need key')
  process.exit(1)
}
console.log('Key', key)
// const multicore = new Multicore('./data-test', {debugLog: true})
const multicore = new Multicore(ram, {debugLog: true})
multicore.on('debugLog', console.log)
let sw
multicore.ready(() => {
  // sw = multicore.joinSwarm({timeout: 1000})
  sw = multicore.joinSwarm()
  sw.on('connection', (peer, info) => {
    // console.log('Connection', prettyHash(peer.id), info, info.id.toString('hex'))
    console.log(`Connection ${prettyHash(info.id)} ${info.host} ` +
                `${info.port} ` +
                (peer.remoteUserData ? peer.remoteUserData.toString() : ''))
  })
  const feed = multicore.createFeed(key)
  console.log('Replicate')
  feed.on('error', err => { console.error('Error', err) })
  feed.ready(() => {
    console.log('Key', feed.key.toString('hex'))
    console.log('Discovery Key', feed.discoveryKey.toString('hex'))
    // multicore.replicateFeed(feed)
    onSync()
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
          // process.exit(1)
        }
        console.log(from, data.toString())
        printChanges(from + 1, cb)
      })
    }
  }
})

function done () {
  console.log('Waiting')
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
  } else if (key.sequence === '1') {
    process.exit()
  } else {
    console.log('key', key)
  }
})

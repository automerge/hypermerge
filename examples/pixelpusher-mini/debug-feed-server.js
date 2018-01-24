const fs = require('fs')
const hypercore = require('hypercore')
const hyperdiscovery = require('hyperdiscovery')
const toBuffer = require('to-buffer')
const prettyHash = require('pretty-hash')
const input = require('diffy/input')()

const key = fs.readFileSync('./data-alice/source', 'utf8')
/*
console.log('Jim key', key)
console.log('Jim key bin', toBuffer(key, 'hex').toString('hex'))
*/
const dk = hypercore.discoveryKey(toBuffer(key, 'hex')).toString('hex')
// console.log('Jim dk', dk)
const dir = './data-alice/feeds/' +
  dk.slice(0, 2) + '/' + dk.slice(2, 4) + '/' + dk.slice(4)
// console.log('Dir', dir)
const feed = hypercore(dir, key)
const sw = hyperdiscovery(feed, {
  utp: false,
  dht: false,
  dns: {server: [], domain: 'dat.local'},
  stream: function (info) {
    // console.log('Jim start replicate', info)
    return feed.replicate({
      live: true,
      upload: true,
      download: true
    })
  }
})
sw.on('connection', (peer, info) => {
  console.log('Connection', prettyHash(peer.id), info, info.id.toString('hex'))
})
sw.on('peer', () => {
  console.log('peer')
})
sw.on('drop', () => {
  console.log('drop')
})

feed.on('ready', () => {
  console.log('Key', feed.key.toString('hex'))
  console.log('Discovery Key', feed.discoveryKey.toString('hex'))
  console.log('Ready', feed.length)
  // onSync()
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
  console.log('Serving...')
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

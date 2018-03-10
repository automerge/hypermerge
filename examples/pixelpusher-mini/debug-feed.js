const hypercore = require('hypercore')
const ram = require('random-access-memory')
const hyperdiscovery = require('hyperdiscovery')

const key = process.argv[2]
if (!key) {
  console.error('Need key')
  process.exit(1)
}
console.log('Key', key)
const feed = hypercore(ram, key)
// const sw = hyperdiscovery(feed, {port: 3282})
const sw = hyperdiscovery(feed, {port: 0})
sw.on('connection', (_, info) => {
  console.log('Connection', info)
})
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
  process.exit()
}

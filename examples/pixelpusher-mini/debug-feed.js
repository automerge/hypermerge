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
const sw = hyperdiscovery(feed)
sw.on('connection', () => { console.log('Connection') })
feed.on('ready', () => {
  console.log('Ready', feed.length)
  feed.on('sync', () => { console.log('sync', feed.length) })
  feed.on('append', () => { console.log('append', feed.length) })
})

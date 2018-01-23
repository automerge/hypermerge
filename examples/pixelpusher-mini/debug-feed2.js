const Multicore = require('../../multicore')
// const ram = require('random-access-memory')

const key = process.argv[2]
if (!key) {
  console.error('Need key')
  process.exit(1)
}
console.log('Key', key)
const multicore = new Multicore('./data-test', {debugLog: true})
multicore.on('debugLog', console.log)
multicore.ready(() => {
  console.log('Jim1')
  const sw = multicore.joinSwarm({timeout: 1000})
  sw.on('connection', () => { console.log('Connection') })
  const feed = multicore.createFeed(key)
  console.log('Replicate')
  feed.on('error', err => { console.error('Error', err) })
  feed.ready(() => {
    console.log('Ready', feed.length)
    console.log('Key', feed.key.toString('hex'))
    // multicore.replicateFeed(feed)
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
})
function done () {
  console.log('Done.')
  process.exit()
}

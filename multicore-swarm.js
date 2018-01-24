var xtend = require('xtend')
var discoverySwarm = require('discovery-swarm')
// var defaults = require('datland-swarm-defaults')

module.exports = swarm

function swarm (archiver, opts) {
  var port = (opts && opts.port) || 3282
  var swarmOpts = xtend({
    utp: false,
    dht: false,
    dns: {server: [], domain: 'dat.local'},
    hash: false,
    stream: function (info) {
      // console.log('New stream', replicateOpts)
      info.userData = opts.userData
      info.timeout = opts.timeout
      return archiver.replicate(info)
    }
  }, opts)

  // var sw = discoverySwarm(defaults(swarmOpts))
  var sw = discoverySwarm(swarmOpts)

  archiver.changes.ready(() => {
    sw.join(archiver.changes.discoveryKey)
  })

  archiver.on('changes', function (feed) {
    sw.join(feed.discoveryKey)
  })

  archiver.on('add', function (feed) {
    sw.join(feed.discoveryKey)
  })

  archiver.on('remove', function (feed) {
    sw.leave(feed.discoveryKey)
  })

  sw.listen(port)
  sw.once('error', function () {
    sw.listen()
  })

  return sw
}

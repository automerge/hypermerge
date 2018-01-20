const pump = require('pump')
const through2 = require('through2')
const debug = require('debug')('protocol')

function replicate (opts) {
  if (!opts) opts = {}

  var self = this
  var stream = self.source.replicate(opts)
  opts = Object.assign({}, opts, {stream})

  if (self.local) {
    self.local.replicate(opts)
  }

  Object.keys(self.peers).forEach(function (key) {
    self.peers[key].replicate(opts)
  })

  return stream
}

class OnlineOfflinePump {
  constructor (target1, target2) {
    this.target1 = target1
    this.target2 = target2
    this.online = false
  }

  goOnline () {
    const self = this
    const opts = {live: true, encrypt: false}
    const stream1 = replicate.call(this.target1, opts)
    const stream2 = replicate.call(this.target2, opts)
    pump(
      stream1,
      through2(function (chunk, enc, cb) {
        debug('l --> r', chunk)
        if (self.online) {
          this.push(chunk)
          cb()
        } else {
          cb(new Error('Offline'))
        }
      }),
      stream2,
      through2(function (chunk, enc, cb) {
        debug('l <-- r', chunk)
        if (self.online) {
          this.push(chunk)
          cb()
        } else {
          cb(new Error('Offline'))
        }
      }),
      stream1,
      err => {
        if (err && err.message !== 'Offline') {
          console.error('Replicate error', err)
        }
      }
    )
    this.online = true
  }

  goOffline () {
    this.online = false
  }
}

module.exports = OnlineOfflinePump

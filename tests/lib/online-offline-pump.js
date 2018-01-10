const pump = require('pump')
const through2 = require('through2')
const debug = require('debug')('protocol')

class OnlineOfflinePump {
  constructor (target1, target2) {
    this.target1 = target1
    this.target2 = target2
    this.online = false
  }

  goOnline () {
    const self = this
    const opts = {live: true, encrypt: false}
    const stream1 = this.target1.replicate(opts)
    const stream2 = this.target2.replicate(opts)
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

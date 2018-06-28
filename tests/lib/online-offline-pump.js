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
    const stream1 = this.target1._replicate(opts)
    const stream2 = this.target2._replicate(opts)
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
    this.target1.core.archiver.on('add', feed => {
      // console.log('target1 add', feed.key.toString('hex'))
      stream1.feed(feed.key)
    })
    this.target2.core.archiver.on('add', feed => {
      // console.log('target2 add', feed.key.toString('hex'))
      stream2.feed(feed.key)
    })
    this.online = true
  }

  goOffline () {
    this.online = false
  }
}

module.exports = OnlineOfflinePump

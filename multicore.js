const {EventEmitter} = require('events')
const Archiver = require('hypercore-archiver')
var protocol = require('hypercore-protocol')
const hypercore = require('hypercore')
const crypto = require('hypercore/lib/crypto')
const thunky = require('thunky')
const swarm = require('./multicore-swarm')

// Monkey-patch hypercore-archiver so we can create a Hypercore
// directly in the archive

Archiver.prototype.createFeed = function (key, opts) {
  const self = this
  opts = opts || {}
  if (!key) {
    // create key pair
    const keyPair = crypto.keyPair()
    key = keyPair.publicKey
    opts.secretKey = keyPair.secretKey
  }
  const dk = hypercore.discoveryKey(key).toString('hex')

  if (this.feeds[dk]) {
    return this.feeds[dk]
  }
  if (this.archives[dk]) {
    return this.archives[dk]
  }

  opts.sparse = this.sparse
  const feed = hypercore(storage(key), key, opts)
  this.feeds[dk] = feed

  this.changes.append({type: 'add', key: key.toString('hex')})

  return feed

  // copied from hypercore-archiver.prototype._add()
  function storage (key) {
    var dk = hypercore.discoveryKey(key).toString('hex')
    var prefix = dk.slice(0, 2) + '/' + dk.slice(2, 4) + '/' + dk.slice(4) + '/'

    return function (name) {
      return self.storage.feeds(prefix + name)
    }
  }
}

// Override so we can pass userData
Archiver.prototype.replicate = function (opts) {
  if (!opts) opts = {}

  if (opts.discoveryKey) opts.discoveryKey = toBuffer(opts.discoveryKey, 'hex')
  if (opts.key) opts.discoveryKey = hypercore.discoveryKey(toBuffer(opts.key, 'hex'))

  const protocolOpts = {
    live: true, id: this.changes.id, encrypt: opts.encrypt
  }
  if (opts.userData) {
    protocolOpts.userData = opts.userData
  }
  var stream = protocol(protocolOpts)
  var self = this

  stream.on('feed', add)
  if (opts.channel || opts.discoveryKey) add(opts.channel || opts.discoveryKey)

  function add (dk) {
    self.ready(function (err) {
      if (err) return stream.destroy(err)
      if (stream.destroyed) return

      var hex = dk.toString('hex')
      var changesHex = self.changes.discoveryKey.toString('hex')

      var archive = self.archives[hex]
      if (archive) return onarchive()

      var feed = changesHex === hex ? self.changes : self.feeds[hex]
      if (feed) return onfeed()

      function onarchive () {
        archive.metadata.replicate({
          stream: stream,
          live: true
        })
        archive.content.replicate({
          stream: stream,
          live: true
        })
      }

      function onfeed () {
        if (stream.destroyed) return

        stream.on('close', onclose)
        stream.on('end', onclose)

        feed.on('_archive', onarchive)
        feed.replicate({
          stream: stream,
          live: true
        })

        function onclose () {
          feed.removeListener('_archive', onarchive)
        }

        function onarchive () {
          if (stream.destroyed) return

          var content = self.archives[hex].content
          content.replicate({
            stream: stream,
            live: true
          })
        }
      }
    })
  }

  return stream
}

class Multicore extends EventEmitter {
  constructor (storage, opts) {
    super()
    opts = opts || {}
    this.archiver = new Archiver(storage)
    this.ready = thunky(open)
    const self = this

    function open (cb) {
      self.opened = true
      self.archiver.on('ready', () => {
        self.emit('ready')
        cb()
      })
    }
  }

  createFeed (key, opts) {
    if (!this.opened) {
      throw new Error('multicore not ready, use .ready()')
    }
    return this.archiver.createFeed(key, opts)
  }

  joinSwarm (opts) {
    opts = Object.assign({}, opts, {live: true})
    // this.emit('debugLog', `Swarm opts: ${JSON.stringify(opts)}`)
    const sw = swarm(this.archiver, opts)
    this.swarm = sw
    this.archiver.ready(() => {
      const feeds = this.archiver.feeds
      Object.keys(feeds).forEach(key => {
        const feed = feeds[key]
        sw.join(feed.discoveryKey)
      })
    })
    return sw
  }
}

module.exports = Multicore

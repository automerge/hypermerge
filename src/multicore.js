const { EventEmitter } = require('events')
const HypercoreProtocol = require('hypercore-protocol')
const HypercoreArchiver = require('hypercore-archiver')
const Hypercore = require('hypercore')
const crypto = require('hypercore/lib/crypto')
const toBuffer = require('to-buffer')
const Debug = require('debug')

const log = Debug('hypermerge:multicore')

// Notes:
// * discovery keys := digest('hypercore', publicKey)
// * this.archiver.feeds indexed by discovery key, hex string representation
// * appends change (just adds?) to a feed (where exactly?) for each tracked core
// * replication??
class Multicore extends EventEmitter {
  constructor (storage) {
    super()
    log('constructor', storage)

    this.archiver = new HypercoreArchiver(storage)
    this.isReady = false
    const self = this
    this.archiver.on('ready', () => {
      self.isReady = true
      self.emit('ready')
    })
  }

  ready (cb) {
    if (this.isReady) {
      cb()
    } else {
      this.on('ready', cb)
    }
  }

  createFeed (key, opts = {}) {
    this._ensureReady()
    log('createFeed', key && key.toString('hex'))

    // Create a key pair if we're making a feed from scratch.
    if (!key) {
      const keyPair = crypto.keyPair()
      key = keyPair.publicKey
      opts.secretKey = keyPair.secretKey
    }

    const dk = Hypercore.discoveryKey(toBuffer(key, 'hex')).toString('hex')

    if (this.archiver.feeds[dk]) {
      return this.archiver.feeds[dk]
    }

    opts.sparse = this.archiver.sparse
    const feed = Hypercore(this._feedStorage(key), key, opts)
    this.archiver.feeds[dk] = feed

    this.archiver.changes.append({ type: 'add', key: key.toString('hex') })
    this.archiver.emit('add', feed)

    return feed
  }

  // Returns a RandomAccessStorage function for the given public feed key.
  // Uses git-style ab/cd/* namespacing and passes that to the underlying
  // storage function given in the constructor.
  _feedStorage (key) {
    const dk = Hypercore.discoveryKey(key).toString('hex')
    const prefix = `${dk.slice(0, 2)}/${dk.slice(2, 4)}/${dk.slice(4)}/`
    return (name) => this.archiver.storage.feeds(prefix + name)
  }

  replicate (opts) {
    this._ensureReady()
    log('replicate')

    if (!opts) {
      opts = {}
    }

    if (opts.discoveryKey) {
      opts.discoveryKey = toBuffer(opts.discoveryKey, 'hex')
    }

    if (opts.key) {
      opts.discoveryKey = Hypercore.discoveryKey(toBuffer(opts.key, 'hex'))
    }

    const { archiver } = this

    const stream = HypercoreProtocol({
      live: true,
      id: archiver.changes.id,
      encrypt: opts.encrypt,
      extensions: ['hypermerge']
    })

    stream.on('feed', add)
    if (opts.channel || opts.discoveryKey) {
      add(opts.channel || opts.discoveryKey)
    }

    function add (dk) {
      const hex = dk.toString('hex')
      log('replicate.add', hex)

      if (stream.destroyed) {
        return
      }

      const changesHex = archiver.changes.discoveryKey.toString('hex')

      const archive = archiver.archives[hex]
      if (archive) {
        onarchive()
        return
      }

      const feed = changesHex === hex ? archiver.changes : archiver.feeds[hex]
      if (feed) {
        onfeed()
      }

      function onarchive () {
        log('replicate.onarchive')

        archive.metadata.replicate({
          stream,
          live: true
        })
        archive.content.replicate({
          stream,
          live: true
        })
      }

      function onfeed () {
        log('replicate.onfeed')

        if (stream.destroyed) {
          return
        }

        stream.on('close', onclose)
        stream.on('end', onclose)

        feed.on('_archive', onarchive)
        feed.replicate({
          stream,
          live: true
        })

        function onclose () {
          log('replicate.onclose')
          feed.removeListener('_archive', onarchive)
        }

        function onarchive () {
          log('replicate.onarchive')
          if (stream.destroyed) {
            return
          }

          const { content } = archiver.archives[hex]
          content.replicate({
            stream,
            live: true
          })
        }
      }
    }

    return stream
  }

  _ensureReady () {
    if (!this.isReady) {
      throw new Error('The HypercoreArchiver instance is not ready yet. Use .on("ready") first.')
    }
  }
}

module.exports = Multicore

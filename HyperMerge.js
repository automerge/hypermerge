const EventEmitter = require('events')
const Automerge = require('automerge')
const MultiCore = require('./MultiCore')
const swarm = require('hypercore-archiver/swarm')

/**
 * Create and share Automerge documents using peer-to-peer networking.
 *
 * @param {Object} options
 * @param {string} options.path - path to directory used to store multiple
 *   hypercores
 * @param {number} [options.port=3282] - port number to listen on
 * @param {onForkCallback} [options.onFork] - unimplemented callback?
 */

 /**
  * onFork callback - unimplemented?
  *
  * @callback onForkCallback
  */

module.exports = class HyperMerge extends EventEmitter {
  constructor ({path, port, onFork}) {
    super()

    this.feeds = {}
    this.docs = {}
    this.metadatas = {}
    this.requestedDeps = {}
    // TODO allow ram:
    this.core = new MultiCore(path)
    this._joinSwarm()

    this.port = port || 3282

    this.core.ready(this._ready())
  }

  /**
   * Have any automerge documents been built?
   *
   * @param {filterCallback} [f] - a filter function
   * @returns {boolean}
   */
  any (f = () => true) {
    return Object.values(this.docs).some(f)
  }

  length (hex) {
    return this.feed(hex).length
  }

  find (hex) {
    if (!this.docs[hex]) {
      throw new Error(`Cannot find document. open(hex) first. Key: ${hex}`)
    }
    return this.docs[hex]
  }

  set (doc) {
    const hex = this.getHex(doc)
    this.docs[hex] = doc
    return this.docs[hex]
  }

  /**
   * Loads a single hypercore feed from the storage directory for a single actor
   * and/or the network swarm, and builds an automerge document.
   *
   * @param {string} hex - key of hypercore / actor id to open
   */
  open (hex) {
    return this.document(hex)
  }

  /**
   * Loads all the hypercore feeds from the storage directory (one per actor)
   * and/or the network swarm, and builds automerge documents for each
   * hypercore/actor.
   */
  openAll () {
    Object.values(this.core.archiver.feeds).forEach(feed => {
      this.open(feed.key.toString('hex'))
    })
  }

  /**
   * Creates a new hypercore feed for a new actor and returns a new
   * automerge document.
   *
   * @param {object} metadata - metadata to be associated with this document
   */
  create (metadata = null) {
    return this.document(null, metadata)
  }

  /**
   * Finds any new changes for the submitted doc for the actor,
   * and appends the changes to the actor's hypercore feed.
   *
   * @param {Object} doc - document to find changes for
   */
  update (doc) {
    const hex = this.getHex(doc)

    if (!this.isOpened(hex)) {
      this.feed(hex).once('ready', () => this.update(doc))
      return doc
    }

    if (!this.isWritable(hex)) {
      throw new Error(`Document not writable. fork() first. Key: ${hex}`)
    }

    const pDoc = this.find(hex)
    const changes = Automerge.getChanges(pDoc, doc)
      .filter(change => change.actor === hex)

    this._appendAll(hex, changes)

    return this.set(doc)
  }

  /**
   * Creates a new actor hypercore feed and automerge document, with
   * an empty change that depends on the document for another actor.
   *
   * @param {string} hex - actor to fork
   * @param {object} metadata - metadata to be associated with this document
   */
  fork (hex, metadata = null) {
    let doc = this.create(metadata)
    doc = Automerge.merge(doc, this.find(hex))
    doc = Automerge.change(doc, `Forked from ${hex}`, () => {})
    return this.update(doc)
  }

  /**
   * Takes all the changes from another actor (hex2) and adds them to
   * the automerge doc.
   * @param {string} hex - actor to merge changes into
   * @param {string} hex2 - actor to copy changes from
   */
  merge (hex, hex2) {
    const doc = Automerge.change(
      Automerge.merge(this.find(hex), this.find(hex2)),
      `Merged with ${hex2}`,
      () => {})
    return this.update(doc)
  }

  /**
   * Removes hypercore feed for an actor and automerge doc.
   *
   * Leaves the network swarm. Doesn't remove files from disk.
   * @param {string} hex
   */
  delete (hex) {
    const doc = this.find(hex)
    this.core.archiver.remove(hex)
    delete this.feeds[hex]
    delete this.docs[hex]
    return doc
  }

  share (hex, destHex) {
    this.message(destHex, {type: 'KEY_SHARED', key: hex})
  }

  message (hex, msg) {
    const data = Buffer.from(JSON.stringify(msg))

    this.feed(hex).peers.forEach(peer => {
      peer.stream.extension('hypermerge', data)
    })
  }

  /**
   * Is the hypercore writable?
   *
   * @param {string} hex - actor id
   * @returns {boolean}
   */
  isWritable (hex) {
    return this.feed(hex).writable
  }

  isOpened (hex) {
    return this.feed(hex).opened
  }

  isMissingDeps (hex) {
    const deps = Automerge.getMissingDeps(this.document(hex))
    return !!Object.keys(deps).length
  }

  document (hex = null, metadata = null) {
    if (hex && this.docs[hex]) return this.docs[hex]

    const feed = this.feed(hex)

    if (!hex) {
      hex = feed.key.toString('hex')
      this._appendMetadata(hex, metadata)
    }

    return this.set(this.empty(hex))
  }

  empty (hex) {
    return Automerge.initImmutable(hex)
  }

  metadata (hex) {
    this.find(hex) // ensure that the document is opened
    return this.metadatas[hex]
  }

  getHex (doc) {
    return doc._actorId
  }

  feed (hex = null) {
    if (hex && this.feeds[hex]) return this.feeds[hex]

    const key = hex ? Buffer.from(hex, 'hex') : null

    return this._trackFeed(this.core.createFeed(key))
  }

  _appendMetadata (hex, metadata) {
    const feed = this.feed(hex)

    if (feed.length > 0) throw new Error(`Metadata can only be set if feed is empty.`)

    this.metadatas[hex] = metadata

    return this._promise(cb => {
      feed.append(JSON.stringify({metadata}), cb)
    })
  }

  _appendAll (hex, changes) {
    return Promise.all(changes.map(change =>
      this._append(hex, change)))
  }

  _append (hex, change) {
    return this._promise(cb => {
      const data = JSON.stringify(change)
      this.feed(hex).append(data, cb)
    })
  }

  _trackFeed (feed) {
    const hex = feed.key.toString('hex')
    this.feeds[hex] = feed

    feed.on('download', this._onDownload(hex))
    feed.on('peer-add', this._onPeerAdded(hex))

    if (feed.opened) {
      this._onFeedReady(hex)()
    } else {
      feed.once('ready', this._onFeedReady(hex))
    }

    return feed
  }

  _loadMetadata (hex) {
    return this._promise(cb => {
      this.feed(hex).get(0, cb)
    })
    .then(this._setMetadata(hex))
  }

  _setMetadata (hex) {
    return data => {
      const {metadata} = data ? JSON.parse(data) : {}
      this.metadatas[hex] = metadata
    }
  }

  _loadAllBlocks (hex) {
    return this._getOwnBlocks(hex)
    .then(blocks => {
      this._maxRequested(hex, hex, blocks.length - 1)
      return this._applyBlocks(hex, blocks)
    })
    .then(() => this._loadMissingBlocks(hex))
  }

  _loadMissingBlocks (hex) {
    const deps = Automerge.getMissingDeps(this.document(hex))

    if (Object.keys(deps).length === 0) {
      return Promise.resolve()
    }

    return Promise.all(Object.keys(deps).map(actor => {
      const last = deps[actor] // NOTE: first block is metadata, don't subtract 1
      const first = this._maxRequested(hex, actor, last)

      return this._getBlockRange(actor, first, last)
      .then(blocks => this._applyBlocks(hex, blocks))
    }))
    .then(() => this._loadMissingBlocks(hex))
  }

  _getOwnBlocks (hex) {
    // NOTE: change blocks start at 1; metadata is at 0:
    return this._getBlockRange(hex, 1, this.length(hex) - 1)
  }

  _getBlockRange (hex, first, last) {
    const length = Math.max(0, last - first + 1)

    return Promise.all(Array(length).fill().map((_, i) =>
      this._getBlock(hex, first + i)))
  }

  _getBlock (hex, index) {
    return this._promise(cb => {
      this.feed(hex).get(index, cb)
    })
  }

  _applyBlocks (hex, blocks) {
    return this._applyChanges(hex, blocks.map(data => JSON.parse(data)))
  }

  _applyChanges (hex, changes) {
    return changes.length > 0
      ? this._setRemote(Automerge.applyChanges(this.document(hex), changes))
      : this.document(hex)
  }

  _maxRequested (hex, actor, max) {
    if (!this.requestedDeps[hex]) this.requestedDeps[hex] = {}
    const current = this.requestedDeps[hex][actor] || 1 // NOTE seqs start at 1
    this.requestedDeps[hex][actor] = Math.max(max, current)
    return current
  }

  _setRemote (doc) {
    const hex = this.getHex(doc)
    this.set(doc)
    if (!this.isMissingDeps(hex)) {
      /**
       * Emitted when all the data from a hypercore feed has been downloaded.
       *
       * @event document:updated
       * @type {object} - automerge document
       */
      this.emit('document:updated', doc)
    }
  }

  _ready () {
    return () => {
      this.emit('ready', this)
    }
  }

  _joinSwarm () {
    this.swarm = swarm(this.core.archiver, {
      port: this.port,
      encrypt: true,
      stream: opts =>
        this.core.replicate(opts)
    })
  }

  _onFeedReady (hex) {
    return () => {
      /**
       * Emitted when a hypercore is ready.
       *
       * @event feed:ready
       * @type {object} - hypercore feed
       */
      this.emit('feed:ready', this.feed(hex))

      return Promise.all([
        this._loadMetadata(hex),
        this._loadAllBlocks(hex)
      ])
      .then(() => {
        /**
         * Emitted when all the data from a hypercore feed has been downloaded.
         *
         * @event document:ready
         * @type {object} - automerge document
         */
        this.emit('document:ready', this.find(hex))
      })
    }
  }

  _onDownload (hex) {
    return (index, data) => {
      // NOTE the first block is metadata:
      if (index === 0) return this._setMetadata(hex)(data)

      this._applyBlocks(hex, [data])
      this._loadMissingBlocks(hex)
    }
  }

  _onPeerAdded (hex) {
    return peer => {
      this.emit('peer:joined', hex, peer)
      peer.stream.on('extension', this._onExtension(hex, peer))
    }
  }

  _onPeerRemoved (hex) {
    return peer => {
      this.emit('peer:left', hex, peer)
    }
  }

  _onExtension (hex, peer) {
    return (name, data) => {
      switch (name) {
        case 'hypermerge':
          return this._onMessage(hex, peer, data)
        default:
          this.emit('peer:extension', hex, name, data, peer)
      }
    }
  }

  _onMessage (hex, peer, data) {
    const msg = JSON.parse(data)

    switch (msg.type) {
      case 'KEY_SHARED':
        return this.document(msg.key)
      case 'KEYS_SHARED':
        return msg.keys.map(key => this.document(key))
      default:
        throw new Error(`Unknown HyperMerge message type: ${msg.type}`)
    }
  }

  _onConnection () {
    return (conn, info) => {
      // console.log('_onConnection', conn)
    }
  }

  _onListening () {
    return (...args) => {
      // console.log('_onListening', ...args)
    }
  }

  _promise (f) {
    return new Promise((resolve, reject) => {
      f((err, x) => {
        err ? reject(err) : resolve(x)
      })
    })
  }
}

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
   */
  create () {
    return this.document()
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
   */
  fork (hex) {
    let doc = this.create()
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
    const doc = Automerge.merge(this.find(hex), this.find(hex2))
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

  document (hex = null) {
    if (hex && this.docs[hex]) return this.docs[hex]

    const feed = this.feed(hex)
    hex = feed.key.toString('hex')

    return this.set(this.empty(hex))
  }

  empty (hex) {
    return Automerge.initImmutable(hex)
  }

  getHex (doc) {
    return doc._actorId
  }

  feed (hex = null) {
    if (hex && this.feeds[hex]) return this.feeds[hex]

    return this._trackFeed(this.core.createFeed(hex))
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

    if (feed.opened) {
      this._onFeedReady(hex)()
    } else {
      feed.on('ready', this._onFeedReady(hex))
    }

    return feed
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

    return Promise.all(Object.keys(deps).map(actor => {
      const last = deps[actor] - 1 // seqs start at 1
      const first = this._maxRequested(hex, actor, last)

      return this._getBlockRange(actor, first, last)
      .then(blocks => this._applyBlocks(hex, blocks))
    }))
  }

  _getOwnBlocks (hex) {
    return this._getBlockRange(hex, 0, this.length(hex) - 1)
  }

  _getBlockRange (hex, first, last) {
    const length = last - first + 1

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
    const current = this.requestedDeps[hex][actor] || 0
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
      encrypt: true
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

      this._loadAllBlocks(hex)
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
    return (_, data) => {
      this._applyBlocks(hex, [data])
      this._loadMissingBlocks(hex)
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

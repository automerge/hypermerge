const EventEmitter = require('events')
const Automerge = require('automerge')
const MultiCore = require('./MultiCore')
const discoverySwarm = require('discovery-swarm')
const swarmDefaults = require('datland-swarm-defaults')

// The first block is used for metadata:
const START_BLOCK = 1
const METADATA = {
  hypermerge: 1
}

/**
 * An Automerge document.
 * @typedef {object} Document
 */

/**
 * Create and share Automerge documents using peer-to-peer networking.
 *
 * @param {Object} options
 * @param {string} options.path - path to directory used to store multiple
 *   hypercores
 * @param {number} [options.port=3282] - port number to listen on
 */

module.exports = class HyperMerge extends EventEmitter {
  constructor ({path, port, defaultMetadata}) {
    super()

    this.defaultMetadata = defaultMetadata || {}
    this.port = port || 3282
    this.isReady = false
    this.feeds = {}
    this.docs = {}
    this.groupIndex = {} // groupId -> [hex]
    this.docIndex = {} // docId -> [hex]
    this.metaIndex = {} // hex -> metadata
    this.requestedBlocks = {} // docId -> hex -> blockIndex (exclusive)

    this.core = new MultiCore(path)

    this.core.ready(this._onMultiCoreReady())
  }

  /**
   * Have any automerge documents been built?
   *
   * @param {filterCallback} [f] - a filter function
   * @returns {boolean}
   */
  any (f = () => true) {
    return Object.keys(this.docs).some(id => f(this.docs[id], id))
  }

  has (docId) {
    return !!this.docs[docId]
  }

  find (docId) {
    const doc = this.docs[docId]

    if (!doc) throw new Error(`Cannot find document. open(docId) first. Key: ${docId}`)

    return doc
  }

  set (doc) {
    const docId = this.getId(doc)
    this.docs[docId] = doc
    return doc
  }

  /**
   * Adds
   * and/or the network swarm, and builds an automerge document.
   *
   * @param {string} hex - docId of document to open
   */
  open (docId, metadata = null) {
    this._ensureReady()

    if (this.docs[docId]) return this.docs[docId]

    // we haven't seen this doc before:
    this.feed(docId)
  }

  /**
   * Creates a new hypercore feed for a new actor and returns a new
   * automerge document.
   *
   * @param {object} metadata - metadata to be associated with this document
   */
  create (metadata = {}) {
    this._ensureReady()
    return this._create(metadata)
  }

  _create (metadata, parentMetadata = {}) {
    const feed = this.feed()
    const hex = feed.key.toString('hex')

    // TODO this is a little wacky:
    metadata = Object.assign(
      {},
      METADATA,
      { groupId: hex },
      parentMetadata,
      this.defaultMetadata,
      { docId: hex },
      metadata
    )

    this._appendMetadata(hex, metadata)

    const doc = this.set(this.empty(hex))
    this._shareDoc(doc)

    return doc
  }

  /**
   * Finds any new changes for the submitted doc for the actor,
   * and appends the changes to the actor's hypercore feed.
   *
   * @param {Object} doc - document to find changes for
   */
  update (doc) {
    this._ensureReady()

    const hex = this.getHex(doc)
    const docId = this.hexToId(hex)
    const pDoc = this.find(docId)

    const changes = Automerge.getChanges(pDoc, doc)
      .filter(({actor}) => actor === hex)

    this._addToMaxRequested(docId, hex, changes.length)

    this._appendAll(hex, changes)

    return this.set(doc)
  }

  /**
   * Creates a new actor hypercore feed and automerge document, with
   * an empty change that depends on the document for another actor.
   *
   * @param {string} parentId - id of document to fork
   */
  fork (parentId) {
    this._ensureReady()

    const parent = this.find(parentId)

    let doc = this._create({parentId}, this.metadata(parentId))
    doc = Automerge.merge(doc, parent)
    doc = Automerge.change(doc, `Forked from ${parentId}`, () => {})

    return this.update(doc)
  }

  /**
   * Takes all the changes from a document (sourceId) and adds them to
   * another document (destId).
   * @param {string} destId - docId to merge changes into
   * @param {string} sourceId - docId to copy changes from
   */
  merge (destId, sourceId) {
    this._ensureReady()

    const dest = this.find(destId)
    const source = this.find(sourceId)

    const doc = Automerge.change(
      Automerge.merge(dest, source),
      `Merged with ${sourceId}`,
      () => {})

    return this.update(doc)
  }

  /**
   * Removes hypercore feed for an actor and automerge doc.
   *
   * Leaves the network swarm. Doesn't remove files from disk.
   * @param {string} docId
   */
  delete (docId) {
    const doc = this.find(docId)
    this.core.archiver.remove(docId)
    delete this.feeds[docId]
    delete this.docs[docId]
    return doc
  }

  message (hex, msg) {
    this.feed(hex).peers.forEach(peer => {
      this._messagePeer(peer, msg)
    })
  }

  length (hex) {
    return this._feed(hex).length
  }

  /**
   * Is the hypercore writable?
   *
   * @param {string} hex - actor id
   * @returns {boolean}
   */
  isWritable (hex) {
    return this._feed(hex).writable
  }

  isOpened (hex) {
    return this._feed(hex).opened
  }

  isMissingDeps (docId) {
    const deps = Automerge.getMissingDeps(this.find(docId))
    return !!Object.keys(deps).length
  }

  empty (actorId) {
    return Automerge.initImmutable(actorId)
  }

  metadatas (docId) {
    const hexes = this.docIndex[docId] || []
    return hexes.map(hex => this.metadata(hex))
  }

  metadata (hex) {
    return this.metaIndex[hex]
  }

  isDocId (hex) {
    return this.hexToId(hex) === hex
  }

  getId (doc) {
    return this.hexToId(this.getHex(doc))
  }

  hexToId (hex) {
    const {docId} = this.metadata(hex)
    return docId
  }

  getHex (doc) {
    return doc._actorId
  }

  clock (doc) {
    return doc._state.getIn(['opSet', 'clock'])
  }

  _feed (hex = null) {
    const key = hex ? Buffer.from(hex, 'hex') : null
    return this.core.createFeed(key)
  }

  feed (hex = null) {
    this._ensureReady()

    if (hex && this.feeds[hex]) return this.feeds[hex]

    return this._trackFeed(this._feed(hex))
  }

  replicate (opts) {
    return this.core.replicate(opts)
  }

  joinSwarm (opts = {}) {
    this._ensureReady()

    const {archiver} = this.core

    const sw = this.swarm = discoverySwarm(swarmDefaults(Object.assign({
      port: this.port,
      hash: false,
      encrypt: true,
      stream: opts => this.replicate(opts)
    }, opts)))

    sw.join(archiver.changes.discoveryKey)

    Object.values(this.feeds).forEach(feed => {
      sw.join(feed.discoveryKey)
    })

    archiver.on('add', feed => {
      sw.join(feed.discoveryKey)
    })

    archiver.on('remove', feed => {
      sw.leave(feed.discoveryKey)
    })

    sw.listen(this.port)

    sw.once('error', err => {
      console.error('Swarm error:', err)
      console.log('Swarm re-listening')
      sw.listen()
    })

    return this
  }

  _appendMetadata (hex, metadata) {
    if (this.length(hex) > 0) throw new Error(`Metadata can only be set if feed is empty.`)

    this._setMetadata(hex, metadata)

    return this._append(hex, metadata)
  }

  _appendAll (hex, changes) {
    return Promise.all(changes.map(change =>
      this._append(hex, change)))
  }

  _append (hex, obj) {
    return _promise(cb => {
      const data = JSON.stringify(obj)
      this.feed(hex).append(data, cb)
    })
  }

  _trackFeed (feed) {
    const hex = feed.key.toString('hex')
    this.feeds[hex] = feed

    feed.ready(this._onFeedReady(hex, feed))

    feed.on('peer-add', this._onPeerAdded(hex))

    return feed
  }

  _onFeedReady (hex, feed) {
    return () => {
      this._loadMetadata(hex)
      .then(() => {
        const docId = this.hexToId(hex)

        this._createDocIfMissing(docId, hex)

        feed.on('download', this._onDownload(docId, hex))

        return this._loadAllBlocks(hex)
      })
      .then(() => {
        const docId = this.hexToId(hex)

        if (docId !== hex) return

        /**
         * Emitted when a document has been fully downloaded.
         *
         * @event document:ready
         * @param {Document} document - automerge document
         */
        this.emit('document:ready', docId, this.find(docId))
      })
      /**
       * Emitted when a hypercore feed is ready.
       *
       * @event feed:ready
       * @param {object} feed - hypercore feed
       */
      this.emit('feed:ready', feed)
    }
  }

  _createDocIfMissing (docId, hex) {
    if (this.docs[docId]) return

    // TODO extra, empty hypercores are still being created

    if (this.isWritable(hex)) {
      this.docs[docId] = this.empty(hex)
    }

    const parentMetadata = this.metadata(hex)

    // TODO might need an empty commit to be included in other vector clocks:
    return this._create({docId}, parentMetadata)
  }

  _initFeeds (hexes) {
    return Promise.all(
      hexes.map(hex => {
        // don't load metadata if the feed is empty:
        if (this.length(hex) === 0) {
          console.log('skipping feed init', hex)
          return Promise.resolve(null)
        }

        return this._loadMetadata(hex)
        .then(({docId}) => {
          if (this.isWritable(hex)) {
            this.docs[docId] = this.empty(hex)
          }
        })
        .then(() => hex)
      }))
  }

  _loadMetadata (hex) {
    if (this.metaIndex[hex]) return Promise.resolve(this.metaIndex[hex])

    return _promise(cb => {
      this._feed(hex).get(0, cb)
    })
    .then(data => this._setMetadata(hex, JSON.parse(data)))
  }

  _setMetadata (hex, metadata) {
    if (this.metaIndex[hex]) return this.metaIndex[hex]

    this.metaIndex[hex] = metadata
    const {docId, groupId} = metadata

    if (!this.groupIndex[groupId]) this.groupIndex[groupId] = []
    this.groupIndex[groupId].push(hex)

    if (!this.docIndex[docId]) this.docIndex[docId] = []
    this.docIndex[docId].push(hex)

    return metadata
  }

  _loadAllBlocks (hex) {
    return this._loadOwnBlocks(hex)
    .then(() => this._loadMissingBlocks(hex))
  }

  _loadOwnBlocks (hex) {
    const docId = this.hexToId(hex)

    return this._loadBlocks(docId, hex, this.length(hex))
  }

  _loadMissingBlocks (hex) {
    const docId = this.hexToId(hex)

    if (docId !== hex) return

    const deps = Automerge.getMissingDeps(this.find(docId))

    return Promise.all(Object.keys(deps).map(actor => {
      const last = deps[actor] + 1 // last is exclusive

      return this._loadBlocks(docId, actor, last)
    }))
  }

  _loadBlocks (docId, hex, last) {
    const first = this._maxRequested(docId, hex, last)

    // Stop requesting if done:
    if (first >= last) return Promise.resolve()

    return this._getBlockRange(hex, first, last)
    .then(blocks => this._applyBlocks(docId, blocks))
    .then(() => this._loadMissingBlocks(docId))
  }

  _getBlockRange (hex, first, last) {
    const length = Math.max(0, last - first)

    return Promise.all(Array(length).fill().map((_, i) =>
      this._getBlock(hex, first + i)))
  }

  _getBlock (hex, index) {
    return _promise(cb => {
      this.feed(hex).get(index, cb)
    })
  }

  _applyBlock (docId, block) {
    return this._applyBlocks(docId, [block])
  }

  _applyBlocks (docId, blocks) {
    return this._applyChanges(docId, blocks.map(block => JSON.parse(block)))
  }

  _applyChanges (docId, changes) {
    return this._setRemote(Automerge.applyChanges(this.find(docId), changes))
  }

  // tracks which blocks have been requested for a given doc,
  // so we know not to request them again
  _maxRequested (docId, hex, max) {
    if (!this.requestedBlocks[docId]) this.requestedBlocks[docId] = {}

    const current = this.requestedBlocks[docId][hex] || START_BLOCK
    this.requestedBlocks[docId][hex] = Math.max(max, current)
    return current
  }

  _addToMaxRequested (docId, hex, x) {
    if (!this.requestedBlocks[docId]) this.requestedBlocks[docId] = {}
    this.requestedBlocks[docId][hex] = (this.requestedBlocks[docId][hex] || START_BLOCK) + x
  }

  _setRemote (doc) {
    const docId = this.getId(doc)

    this.set(doc)

    if (!this.isMissingDeps(docId)) {
      /**
       * Emitted when an updated document has been downloaded.
       *
       * @event document:updated
       * @param {Document} document - automerge document
       */
      this.emit('document:updated', docId, doc)
    }
  }

  _shareDoc (doc) {
    const {groupId} = this.metadata(this.getHex(doc))
    const keys = this.groupIndex[groupId]
    this.message(groupId, {type: 'FEEDS_SHARED', keys})
  }

  _relatedKeys (hex) {
    const {groupId} = this.metadata(hex)
    return this.groupIndex[groupId]
  }

  _messagePeer (peer, msg) {
    const data = Buffer.from(JSON.stringify(msg))
    peer.stream.extension('hypermerge', data)
  }

  _onMultiCoreReady () {
    return () => {
      const hexes =
        Object.values(this.core.archiver.feeds)
        .map(feed => feed.key.toString('hex'))

      this._initFeeds(hexes)
      .then(() => {
        this.isReady = true
        hexes.forEach(hex => this.feed(hex))
        this.emit('ready', this)
      })

      this.core.archiver.on('add', feed => {
        this.feed(feed.key.toString('hex'))
      })
    }
  }

  _onDownload (docId, hex) {
    return (index, data) => {
      this._applyBlock(docId, data)
      this._loadMissingBlocks(hex)
    }
  }

  _onPeerAdded (hex) {
    return peer => {
      peer.stream.on('extension', this._onExtension(hex, peer))

      this._loadMetadata(hex)
      .then(() => {
        if (!this.isDocId(hex)) return

        const keys = this._relatedKeys(hex)
        this._messagePeer(peer, {type: 'FEEDS_SHARED', keys})
      })

      this.emit('peer:joined', hex, peer)
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
      case 'FEEDS_SHARED':
        return msg.keys.map(hex => this.feed(hex))
      default:
        throw new Error(`Unknown HyperMerge message type: ${msg.type}`)
    }
  }

  _onConnection (docId, hex) {
    return (conn, info) => {
      console.log('_onConnection', conn, info)
    }
  }

  _onListening () {
    return (...args) => {
      // console.log('_onListening', ...args)
    }
  }

  _ensureReady () {
    if (!this.isReady) throw new Error('HyperMerge is not ready yet. Use .once("ready") first.')
  }
}

function _promise (f) {
  return new Promise((resolve, reject) => {
    f((err, x) => {
      err ? reject(err) : resolve(x)
    })
  })
}

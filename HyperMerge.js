const EventEmitter = require('events')
const Automerge = require('automerge')
const MultiCore = require('./MultiCore')
const swarm = require('hypercore-archiver/swarm')

// The first block is used for metadata:
const START_BLOCK = 1

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
    this.isReady = false
    this.docs = {}
    this.infos = {} // hex -> info
    this.requestedBlocks = {} // docId -> hex -> blockIndex (exclusive)
    this.requiredBlocks = {} // docId -> hex -> blockIndex (exclusive)
    // TODO allow ram:
    this.core = new MultiCore(path)

    this.port = port || 3282

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

    let doc = this._create({docId, groupId: undefined, metadata})
    doc = Automerge.change(doc, 'Opened doc', () => {})

    this._shareDoc(doc)

    return this.update(doc)
  }

  /**
   * Creates a new hypercore feed for a new actor and returns a new
   * automerge document.
   *
   * @param {object} metadata - metadata to be associated with this document
   */
  create (metadata = null) {
    this._ensureReady()

    return this._create({metadata})
  }

  _create (info) {
    const feed = this.feed()
    const hex = feed.key.toString('hex')

    info.hypermerge = 1

    if (!('docId' in info)) info.docId = hex
    if (!('groupId' in info)) info.groupId = hex

    this._appendInfo(hex, info)

    return this.set(this.empty(hex))
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

    this._appendAll(hex, changes)

    // TODO maybe set maxRequested so we don't download ourself:
    // this._maxRequested(docId, hex, this.length(hex) + changes.length)

    return this.set(doc)
  }

  /**
   * Creates a new actor hypercore feed and automerge document, with
   * an empty change that depends on the document for another actor.
   *
   * @param {string} parentId - id of document to fork
   * @param {object} metadata - metadata to be associated with the new document
   */
  fork (parentId, metadata = null) {
    this._ensureReady()

    const parent = this.find(parentId)
    const {groupId} = this.info(parentId)
    let doc = this._create({groupId, parentId, metadata})
    doc = Automerge.merge(doc, parent)
    doc = Automerge.change(doc, `Forked from ${parentId}`, () => {})
    this.message(parentId, {type: 'DOC_SHARED', id: this.getHex(doc)})
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
    const data = Buffer.from(JSON.stringify(msg))

    this.feed(hex).peers.forEach(peer => {
      peer.stream.extension('hypermerge', data)
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

  info (hex) {
    return this.infos[hex]
  }

  metadata (hex) {
    const info = this.info(hex) || {}
    return info.metadata
  }

  isDocId (hex) {
    return this.hexToId(hex) === hex
  }

  getId (doc) {
    return this.hexToId(this.getHex(doc))
  }

  hexToId (hex) {
    const {docId} = this.info(hex)
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
    this.swarm = swarm(this.core.archiver, Object.assign({
      port: this.port,
      encrypt: true,
      stream: opts =>
        this.replicate(opts)
    }, opts))

    return this
  }

  _appendInfo (hex, info) {
    if (this.length(hex) > 0) throw new Error(`Info can only be set if feed is empty.`)

    this.infos[hex] = info

    return this._append(hex, info)
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

    return feed
  }

  _onFeedReady (hex, feed) {
    return () => {
      /**
       * Emitted when a hypercore feed is ready.
       *
       * @event feed:ready
       * @param {object} feed - hypercore feed
       */
      this.emit('feed:ready', feed)

      this._loadInfo(hex)
      .then(() => {
        const docId = this.hexToId(hex)

        feed.on('download', this._onDownload(docId, hex))
        feed.on('peer-add', this._onPeerAdded(hex))

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
    }
  }

  _loadInfos (hexes) {
    return Promise.all(
      hexes.map(hex => {
        // don't load metadata if the feed is empty:
        if (this.length(hex) === 0) return Promise.resolve(null)

        return this._loadInfo(hex)
        .then(() => hex)
      }))
  }

  _loadInfo (hex) {
    if (this.infos[hex]) return Promise.resolve(this.infos[hex])

    return _promise(cb => {
      this._feed(hex).get(0, cb)
    })
    .then(this._setInfo(hex))
  }

  _setInfo (hex) {
    return data => {
      const info = data ? JSON.parse(data) : {}
      const {docId} = info

      this.infos[hex] = info

      if (this.isWritable(hex)) {
        this.docs[docId] = this.empty(hex)
      }

      return info
    }
  }

  // _recordBlock (docId, block) {
  //   this._recordChange(docId, JSON.parse(block))
  // }

  // _recordChange (docId, change) {
  //   const {actor, seq, deps} = change

  //   if (!this.docs[docId] || !this.pending[docId]) {
  //     this.pending[docId] = this.empty(actor)
  //   }

  //   this._applyChange(docId, change)
  //   // TODO update requiredBlocks and request missing Blocks:
  //   // _each(deps, (depSeq, depActor) => {
  //   //   this.requiredBlocks[docId]
  //   // })
  // }

  _loadAllBlocks (hex) {
    return this._loadOwnBlocks(hex)
    .then(() => this._loadMissingBlocks(hex))
  }

  _loadOwnBlocks (hex) {
    const docId = this.hexToId(hex)

    return this._getOwnBlocks(hex)
    .then(blocks => {
      this._maxRequested(docId, hex, blocks.length)
      return this._applyBlocks(docId, blocks)
    })
  }

  // a missing block is a block between requiredBlocks and requestedBlocks
  _loadMissingBlocks (hex) {
    const docId = this.hexToId(hex)

    if (docId !== hex) return

    const deps = Automerge.getMissingDeps(this.find(docId))

    return Promise.all(Object.keys(deps).map(actor => {
      const last = deps[actor] + 1 // last is exclusive
      const first = this._maxRequested(docId, actor, last)

      // Stop requesting if done:
      if (first === last) return null

      return this._getBlockRange(actor, first, last)
      .then(blocks => this._applyBlocks(docId, blocks))
      .then(() => this._loadMissingBlocks(docId))
    }))
  }

  _getOwnBlocks (hex) {
    return this._getBlockRange(hex, START_BLOCK, this.length(hex))
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
    const docId = this.getId(doc)
    const keys = this.clock(doc).keySeq()
    this.message(docId, {type: 'FEEDS_SHARED', keys})
  }

  _relatedKeys (hex) {
    const docId = this.hexToId(hex)
    const doc = this.find(docId)
    return this.clock(doc).keySeq()
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

      this._loadInfos(hexes)
      .then(() => {
        this.isReady = true
        hexes.forEach(hex => this.feed(hex))
        this.emit('ready', this)
      })

      // // TODO maybe watch for added feeds:
      // this.core.archiver.on('add', feed => {
      //   this.feed(feed.key.toString('hex'))
      // })
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
      if (this.isDocId(hex)) {
        const keys = this._relatedKeys(hex)
        if (keys.size) {
          this._messagePeer(peer, {type: 'FEEDS_SHARED', keys})
        }
      }

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
      case 'FEEDS_SHARED':
        return msg.keys.map(hex => this.feed(hex))
      case 'DOC_SHARED':
        return this.emit('document:shared', msg.id)
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

// function _each (obj, f) {
//   Object.keys(obj).forEach(k => {
//     f(obj[k], k)
//   })
// }

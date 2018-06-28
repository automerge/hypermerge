const EventEmitter = require('events')
const Automerge = require('automerge')
const discoverySwarm = require('discovery-swarm')
const swarmDefaults = require('dat-swarm-defaults')
const Debug = require('debug')

const Multicore = require('./src/multicore')
const Hyperfile = require('./src/hyperfile')
const DocHandle = require('./src/doc-handle')

const log = Debug('hypermerge:index')

// TODO: basic model
// actorId
// docId
// feedId
// groupId
// docId == actorId for writable
// actorId persistent for the same device/user over time, across restarts

// The first block of each Hypercore feed is used for metadata.
const START_BLOCK = 1

// One piece of metadata every feed will have indicates that the feed is
// managed by Hypermerge.
const METADATA = {
  hypermerge: 1
}

/**
 * An Automerge document.
 * @typedef {object} Document
 */
/**
 * Creates a new Hypermerge instance that manages a set of documents.
 * All previously opened documents are automatically re-opened.
 * @param {object} options
 * @param {object} options.storage - config compatible with Hypercore constructor storage param
 * @param {boolean} [options.immutableApi=false] - whether to use Immutable.js Automerge API
 * @param {number} [options.port=0] - port number to listen on
 * @param {object} [defaultMetadata={}] - default metadata that should be written for new docs
 */
class Hypermerge extends EventEmitter {
  constructor ({ storage, port = 0, immutableApi = false, defaultMetadata = {} }) {
    super()

    this.immutableApi = immutableApi
    this.defaultMetadata = defaultMetadata
    this.port = port

    this.isReady = false
    this.feeds = {}
    this.docs = {}
    this.handles = {} // docId -> [DocHandle]
    this.readyIndex = {} // docId -> Boolean
    this.groupIndex = {} // groupId -> [actorId]
    this.docIndex = {} // docId -> [actorId]
    this.metaIndex = {} // actorId -> metadata
    this.requestedBlocks = {} // docId -> actorId -> blockIndex (exclusive)
    this.appliedSeqs = {} // actorId -> seq -> Boolean

    this._onMulticoreReady = this._onMulticoreReady.bind(this)
    this.core = new Multicore(storage)
    this.core.on('ready', this._onMulticoreReady)
  }

  writeFile (pathOrBuffer, callback) {
    if (Buffer.isBuffer(pathOrBuffer)) {
      Hyperfile.writeBuffer(this.core, pathOrBuffer, callback)
    } else {
      Hyperfile.write(this.core, pathOrBuffer, callback)
    }
  }

  fetchFile (hyperfileId, callback) {
    Hyperfile.fetch(this.core, hyperfileId, callback)
  }

  /**
   * Joins the network swarm for all documents managed by this Hypermerge instance.
   * Must be called after `'ready'` has been emitted. `opts` are passed to discovery-swarm.
   */
  joinSwarm (opts = {}) {
    this._ensureReady()
    log('joinSwarm')

    this.swarm = discoverySwarm(swarmDefaults(Object.assign({
      port: this.port,
      hash: false,
      encrypt: true,
      stream: opts => this._replicate(opts)
    }, opts)))

    this.swarm.join(this.core.archiver.changes.discoveryKey)

    Object.values(this.feeds).forEach(feed => {
      this.swarm.join(feed.discoveryKey)
    })

    this.core.archiver.on('add', feed => {
      this.swarm.join(feed.discoveryKey)
    })

    this.core.archiver.on('remove', feed => {
      this.swarm.leave(feed.discoveryKey)
    })

    this.swarm.listen(this.port)

    this.swarm.once('error', err => {
      log('joinSwarm.error', err)
      this.swarm.listen()
    })

    return this
  }

  /**
   * Returns the document for the given docId.
   * Throws if the document has not been opened yet.
   */
  find (docId) {
    if (this.readyIndex[docId]) {
      return this.docs[docId]
    }

    const doc = this.docs[docId]

    if (!doc) {
      throw new Error(`Cannot find document. open(docId) first. docId: ${docId}`)
    }

    return doc
  }

  /**
   * Returns the `docId` for the given `doc`. Note that this is id of the logical
   * doc managed by Hypermerge, and not neccisarily the Automerge doc id.
   */
  getId (doc) {
    return this._actorToId(this._getActorId(doc))
  }

  openHandle (docId) {
    this._ensureReady()

    log('openHandle', docId)

    this._trackedFeed(docId)

    const doc = this.readyIndex[docId] ? this.docs[docId] : null

    const handle = new DocHandle(this, docId, doc)

    this._handles(docId).push(handle)

    return handle
  }

  releaseHandle (handle) {
    log('releaseHandle', handle)

    const handles = this.handles[handle.id]

    if (!handles) {
      throw new Error(`No handles found for docId: ${handle.id}.`)
    }

    this.handles[handle.id] = handles.filter(h => h !== handle)

    return true
  }

  /**
   * Creates an Automerge document backed by a new Hypercore.
   *
   * If metadata is passed, it will be associated with the newly created document.
   * Some metadata properties are assigned automatically by Hypermerge:
   *  - docId: An id for this document. Forking a document creates a new docId.
   *  - groupId: An id for this group of documents. Forking a document keeps the groupId.
   *
   * @param {object} metadata - metadata to be associated with this document
   */
  create (metadata = {}) {
    this._ensureReady()
    log('create')
    return this._create(metadata)
  }

  /**
   * Shorthand for `hm.update(Automerge.change(doc, changeFn))`.
   */
  change (doc, message = null, changeFn) {
    const docId = this.getId(doc)
    log('change', docId)
    return this.update(Automerge.change(doc, message, changeFn))
  }

  /**
   * Finds any new changes for the submitted doc for the actor,
   * and appends the changes to the actor's Hypercore feed.
   *
   * @param {Object} doc - document to find changes for
   */
  update (doc) {
    this._ensureReady()

    const actorId = this._getActorId(doc)
    const docId = this._actorToId(actorId)
    const pDoc = this.find(docId)
    log('update', docId, actorId)

    const changes = Automerge.getChanges(pDoc, doc)
      .filter(({ actor }) => actor === actorId)

    this._addToMaxRequested(docId, actorId, changes.length)
    this._appendAll(actorId, changes)
    this._set(docId, doc)
    this.emit('document:updated', docId, doc)
    this._handles(docId).forEach(handle => {
      handle._update(doc)
    })

    return doc
  }

  /**
   * Creates a new actor Hypercore feed and Automerge document, with
   * an empty change that depends on the document for another actor.
   * The metadata of the new document will contain a `parentId` property.
   *
   * @param {string} parentId - id of document to fork
   */
  fork (parentId) {
    this._ensureReady()
    log('fork', parentId)

    const parent = this.find(parentId)
    const doc = this._create({ parentId }, this.metadata(parentId))

    return this.change(
      Automerge.merge(doc, parent),
      `Forked from ${parentId}`,
      () => {}
    )
  }

  /**
   * Takes all the changes from a document (sourceId) and adds them to
   * another document (destId). Returns the merged document.
   *
   * The source and destination docs must have come from the same root document.
   * e.g. The source doc was a `.fork()` of the destination doc, or visa-versa.
   *
   * @param {string} destId - docId to merge changes into
   * @param {string} sourceId - docId to copy changes from
   */
  merge (destId, sourceId) {
    this._ensureReady()
    log('merge', destId, sourceId)

    const dest = this.find(destId)
    const source = this.find(sourceId)

    return this.change(
      Automerge.merge(dest, source),
      `Merged with ${sourceId}`,
      () => {}
    )
  }

  /**
   * Removes Hypercore feed for an actor and Automerge doc.
   *
   * Leaves the network swarm. Doesn't remove files from disk.
   * @param {string} docId
   */
  delete (docId) {
    log('delete', docId)
    const doc = this.find(docId)
    this.core.archiver.remove(docId)
    delete this.feeds[docId]
    delete this.docs[docId]
    return doc
  }

  /**
   * Returns the list of metadata objects corresponding to the list of actors
   * that have edited this document.
   */
  metadatas (docId) {
    const actorIds = this.docIndex[docId] || []
    return actorIds.map(actorId => this.metadata(actorId))
  }

  /**
  * Returns the metadata object for the given `actorId`.
  */
  metadata (actorId) {
    return this.metaIndex[actorId]
  }

  /**
   * Send the given `msg`, which can be any JSON.stringify-able data, to all
   * peers currently listening on the feed for `actorId`.
   */
  message (actorId, msg) {
    this._trackedFeed(actorId).peers.forEach(peer => {
      this._messagePeer(peer, msg)
    })
  }

  _handles (docId) {
    if (!this.handles[docId]) {
      this.handles[docId] = []
    }
    return this.handles[docId]
  }

  _create (metadata, parentMetadata = {}) {
    const feed = this._trackedFeed()
    const actorId = feed.key.toString('hex')
    log('_create', actorId)

    // Merge together the various sources of metadata, from lowest-priority to
    // highest priority.
    metadata = Object.assign(
      {},
      METADATA,
      { groupId: actorId }, // default to self if parent doesn't have groupId
      parentMetadata, // metadata of the parent feed to this feed (e.g. when opening, forking)
      this.defaultMetadata, // user-specified default metadata
      { docId: actorId }, // set the docId to this core's actorId by default
      metadata // directly provided metadata should override everything else
    )
    const { docId } = metadata
    const doc = this._empty(actorId)

    this._appendMetadata(actorId, metadata)
    this._set(docId, doc)
    this._shareDoc(doc)

    return doc
  }

  // Returns the number of blocks available for the feed corresponding to the
  // given `actorId`.
  _length (actorId) {
    return this._feed(actorId).length
  }

  // Returns an empty Automerge document with the given `actorId`. Used as the
  // starting point for building up an in-memory doc for this process.
  _empty (actorId) {
    return this.immutableApi
      ? Automerge.initImmutable(actorId)
      : Automerge.init(actorId)
  }

  // Returns true if the given `actorId` corresponds to a doc with a matching id.
  // This occurs when we this actor originally created the doc.
  _isDocId (actorId) {
    return this._actorToId(actorId) === actorId
  }

  // Returns the logical doc id corresponding to the given `actorId`.
  _actorToId (actorId) {
    const { docId } = this.metadata(actorId)
    return docId
  }

  // Returns our own actorId for the given `doc`.
  _getActorId (doc) {
    return doc._actorId
  }

  // Finds or creates, and returns, a feed that is not yet tracked. See `feed`
  // for cases for `actorId`.
  _feed (actorId = null) {
    const key = actorId ? Buffer.from(actorId, 'hex') : null
    log('_feed', actorId)
    return this.core.createFeed(key)
  }

  // Finds or creates, and returns, a tracked feed. This means that updates to
  // the feed will cause updates to in-memory docs, emit events, etc.
  //
  // There are three cases:
  // * `actorId` is not given, and we create a new feed with a random actorId.
  // * `actorId` is given but we don't have a feed yet because we just found
  //   out about it from another user - create the feed with the given actorId.
  // * `actorId` is given and we know of the feed already - return from cache.
  _trackedFeed (actorId = null) {
    this._ensureReady()

    if (actorId && this.feeds[actorId]) {
      return this.feeds[actorId]
    }

    log('feed.init', actorId)
    return this._trackFeed(this._feed(actorId))
  }

  _replicate (opts) {
    return this.core.replicate(opts)
  }

  // Append the given `metadata` for the given `actorId` to the corresponding
  // feed, and also set that metadata in memory.
  _appendMetadata (actorId, metadata) {
    if (this._length(actorId) > 0) {
      throw new Error('Metadata can only be set if feed is empty.')
    }

    this._setMetadata(actorId, metadata)
    this._append(actorId, metadata)
  }

  // App the given `change` to feed for `actorId`. Returns a promise that
  // resolves with no value on completion, or rejects with an error if one occurs.
  _append (actorId, change) {
    log('_append', actorId)
    return this._appendAll(actorId, [change])
  }

  // Append all given `changes` to feed for `actorId`. Returns a promise that
  // resolves with no value on completion, or rejects with an error if one occurs.
  _appendAll (actorId, changes) {
    log('_appendAll', actorId)
    const blocks = changes.map(change => JSON.stringify(change))
    return new Promise((resolve, reject) => {
      this._trackedFeed(actorId).append(blocks, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  // Track the given `feed`, which must correspond to the given `actorId`,
  // setting up listeners for when peers are added/removed, data is
  // downloaded, etc.
  _trackFeed (feed) {
    const actorId = feed.key.toString('hex')
    log('_trackFeed', actorId)

    this.feeds[actorId] = feed

    feed.ready(this._onFeedReady(actorId, feed))
    feed.on('peer-add', this._onPeerAdded(actorId))
    feed.on('peer-remove', this._onPeerRemoved(actorId))

    return feed
  }

  // Returns a callback to run when the given `feed`, corresponding to the
  // given `actorId`, is ready.
  // Callback will load metadata for the feed, ensure we have an in-memory
  // doc corresponding to the logical doc of which the feed is a part, set
  // up download callback, and load & apply all existing blocks in the feed
  // plus their dependencies. Finally, it will notify corresponding open
  // handles that the doc is ready.
  _onFeedReady (actorId, feed) {
    return () => {
      log('_onFeedReady', actorId)
      this._loadMetadata(actorId)
        .then(() => {
          const docId = this._actorToId(actorId)

          this._createDocIfMissing(docId, actorId)

          feed.on('download', this._onDownload(docId, actorId))

          const ourActorId = this.docs[docId]._actorId

          return this._loadBlocksWithDependencies(docId, actorId, this._length(actorId))
            .then(() => {
              if (actorId !== ourActorId) {
                return
              }

              this.readyIndex[docId] = true
              const doc = this.find(docId)
              this._handles(docId).forEach(handle => {
                handle._ready(doc)
              })
            })
        })
    }
  }

  // Returns true if the Hypercore corresponding to the given actorId is
  // writable. For each doc managed by hypermerge we should have one Hypercore
  // that we created and that's writable by us. The others will not be.
  _isWritable (actorId) {
    return this._feed(actorId).writable
  }

  // Ensures that we have both an in-memory doc and a feed for the given `docId`.
  // We pass `actorId` because the in-memory doc should have our `actorId`, and
  // so we only create it when it's missing and this condition is true. We will
  // need to create the on-disk feed for `docId` when we have a doc shared with
  // us from another user.
  _createDocIfMissing (docId, actorId) {
    if (this.docs[docId]) {
      return
    }

    if (this._isWritable(actorId)) {
      this.docs[docId] = this._empty(actorId)
    }

    const parentMetadata = this.metadata(actorId)

    this._create({ docId }, parentMetadata)
  }

  // Initialize in-memory data structures corresponding to the feeds we already
  // know about. Sets metadata for each feed, and creates and empty doc
  // corresponding to each Hypermerge doc. These docs will later (not here) be
  // updated in memory as we load changes from the corresponding Hypercores
  // from disk and network.
  //
  // Returns a promise that resolves when all this work is complete.
  _initFeeds (actorIds) {
    log('_initFeeds')
    const promises = actorIds.map((actorId) => {
      // Don't load metadata if the feed is empty.
      if (this._length(actorId) === 0) {
        log('_initFeeds.skipEmpty', actorId)
        return Promise.resolve(null)
      }

      return this._loadMetadata(actorId)
        .then(({ docId }) => {
          if (this._isWritable(actorId)) {
            this.docs[docId] = this._empty(actorId)
          }
        })
    })
    return Promise.all(promises)
  }

  // Ensures that metadata for the feed corresponding to `actorId` has been
  // loaded from disk and set in memory. Will only load from disk once as
  // metadata is immutable.
  //
  // Returns a promise resolving to the metadata.
  _loadMetadata (actorId) {
    if (this.metaIndex[actorId]) {
      return Promise.resolve(this.metaIndex[actorId])
    }

    return new Promise((resolve, reject) => {
      this._feed(actorId).get(0, (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
      .then(data => this._setMetadata(actorId, JSON.parse(data)))
  }

  // Sets the given `metadata` in memory for the given `actorId`.
  // Does not write to disk: see `_appendMetadata`.
  _setMetadata (actorId, metadata) {
    if (this.metaIndex[actorId]) {
      return this.metaIndex[actorId]
    }

    this.metaIndex[actorId] = metadata
    const { docId, groupId } = metadata

    if (!this.groupIndex[groupId]) {
      this.groupIndex[groupId] = []
    }
    this.groupIndex[groupId].push(actorId)

    if (!this.docIndex[docId]) {
      this.docIndex[docId] = []
    }
    this.docIndex[docId].push(actorId)

    return metadata
  }

  // Loads all blocks for the given `docId` + `actorId`, and applies them
  // to the corresponding in-memory document. Also loads and applies all blocks
  // on which any of those changes depend, recursively.
  //
  // Returns a promise that resolves when this completes.
  //
  // NOTE: RACE!!
  _loadBlocksWithDependencies (docId, actorId, last) {
    const first = this._maxRequested(docId, actorId, last)
    log('_loadBlocksWithDependencies', docId, actorId, first, last)

    // Stop requesting if done.
    if (first >= last) {
      return Promise.resolve()
    }

    return this._getBlockRange(actorId, first, last)
      .then(blocks => this._applyBlocks(docId, blocks))
      .then(() => this._loadMissingDependencyBlocks(docId))
  }

  // Loads and applies all blocks depended on by changes currently applied to
  // the doc for the given `docId`, recursively.
  //
  // Returns a promise that resolves when this completes.
  //
  // NOTE: RACE!!
  _loadMissingDependencyBlocks (docId) {
    log('_loadMissingDependencyBlocks', docId)

    const doc = this.find(docId)
    const deps = Automerge.getMissingDeps(doc)
    return Promise.all(Object.keys(deps).map((actorId) => {
      const last = deps[actorId] + 1 // last is exclusive
      return this._loadBlocksWithDependencies(docId, actorId, last)
    }))
  }

  // Returns a promise that resolves to an array of blocks corresponding to the
  // arguments, once all of those fetches are complete.
  _getBlockRange (actorId, first, last) {
    log('_getBlockRange.start', actorId, first, last)

    if (last < first) {
      throw new Error(`Unexpected last < first: ${last}, ${first}`)
    }
    return new Promise((resolve, reject) => {
      this._trackedFeed(actorId).getBatch(first, last, (err, blocks) => {
        if (err) {
          reject(err)
        } else {
          log('getBlockRange.resolve', actorId, first, last)
          resolve(blocks)
        }
      })
    })
  }

  // Applies the given `blocks` to the in-memory doc corresponding to the
  // given `docId`.
  _applyBlock (docId, block) {
    log('_applyBlock', docId)
    this._applyBlocks(docId, [block])
  }

  // Applies the given `blocks` to the in-memory doc corresponding to the
  // given `docId`.
  _applyBlocks (docId, blocks) {
    log('_applyBlocks', docId)
    this._applyChanges(docId, blocks.map(block => JSON.parse(block)))
  }

  // Applies the given `changes` to the in-memory doc corresponding to the
  // given `docId`.
  _applyChanges (docId, changes) {
    log('_applyChanges', docId)
    if (changes.length > 0) {
      const oldDoc = this.find(docId)
      const filteredChanges = []
      changes.forEach((change) => {
        if (!this.appliedSeqs[change.actor]) {
          this.appliedSeqs[change.actor] = {}
        }
        if (this.appliedSeqs[change.actor][change.seq]) {
          log('_applyChanges.skipDuplicate', change.actor, change.seq)
        } else {
          filteredChanges.push(change)
          this.appliedSeqs[change.actor][change.seq] = true
        }
      })
      const newDoc = Automerge.applyChanges(oldDoc, filteredChanges)
      this._setRemote(docId, newDoc)
    }
  }

  // Tracks which blocks have been requested for a given doc,
  // so we know not to request them again.
  _maxRequested (docId, actorId, max) {
    if (!this.requestedBlocks[docId]) {
      this.requestedBlocks[docId] = {}
    }

    const current = this.requestedBlocks[docId][actorId] || START_BLOCK
    this.requestedBlocks[docId][actorId] = Math.max(max, current)
    return current
  }

  _addToMaxRequested (docId, actorId, x) {
    if (!this.requestedBlocks[docId]) {
      this.requestedBlocks[docId] = {}
    }
    this.requestedBlocks[docId][actorId] = (this.requestedBlocks[docId][actorId] || START_BLOCK) + x
  }

  // Updates our register of Automerge docs, setting `docId` to point to the
  // given `doc`. Will not emit `document:updated`, so should only be used
  // when registering our own updates or by a caller that will themself emit
  // the event.
  _set (docId, doc) {
    log('set', docId)
    this.docs[docId] = doc
  }

  // Updates our register of Automerge docs, setting `docId` to point to the
  // given `doc`. Will emit `document:updated` (if the doc is ready), so
  // appropriate for updates to the doc due to remote sources.
  _setRemote (docId, doc) {
    log('_setRemote', docId)

    this._set(docId, doc)
    if (this.readyIndex[docId]) {
      /**
       * Emitted when an updated document has been downloaded. Not emitted
       * after local calls to `.update()` or `.change()`.
       *
       * @event document:updated
       *
       * @param {string} docId - the hex id representing this document
       * @param {Document} doc - Automerge document
       */
      this.emit('document:updated', docId, doc)
      this._handles(docId).forEach(handle => {
        handle._update(doc)
      })
    }
  }

  _shareDoc (doc) {
    const { groupId } = this.metadata(this._getActorId(doc))
    const keys = this.groupIndex[groupId]
    this.message(groupId, { type: 'FEEDS_SHARED', keys })
  }

  _relatedKeys (actorId) {
    const { groupId } = this.metadata(actorId)
    return this.groupIndex[groupId]
  }

  _messagePeer (peer, msg) {
    const data = Buffer.from(JSON.stringify(msg))
    peer.stream.extension('hypermerge', data)
  }

  _onMulticoreReady () {
    log('_onMulticoreReady')

    const actorIds =
      Object.values(this.core.archiver.feeds)
        .map(feed => feed.key.toString('hex'))

    this._initFeeds(actorIds)
      .then(() => {
        this.isReady = true
        actorIds.forEach(actorId => this._trackedFeed(actorId))

        /**
         * Emitted when all document metadata has been loaded from storage, and the
         * Hypermerge instance is ready for use. Documents will continue loading from
         * storage and the network. Required before `.openHandle()`, etc. can be used.
         *
         * @event ready
         */
        this.emit('ready')
      })
  }

  _onDownload (docId, actorId) {
    return (index, data) => {
      log('_onDownload', docId, actorId, index)
      this._applyBlock(docId, data)
      this._loadMissingDependencyBlocks(docId)
    }
  }

  _onPeerAdded (actorId) {
    return (peer) => {
      peer.stream.on('extension', this._onExtension(actorId, peer))

      this._loadMetadata(actorId)
        .then(() => {
          if (!this._isDocId(actorId)) {
            return
          }

          const keys = this._relatedKeys(actorId)
          this._messagePeer(peer, { type: 'FEEDS_SHARED', keys })

          /**
           * Emitted when a network peer has connected.
           *
           * @event peer:left
           *
           * @param {string} actorId - the actorId of the connected peer
           * @param {object} peer - information about the connected peer
           */
          this.emit('peer:joined', actorId, peer)
        })
    }
  }

  _onPeerRemoved (actorId) {
    return peer => {
      this._loadMetadata(actorId)
        .then(() => {
          if (!this._isDocId(actorId)) {
            return
          }

          /**
           * Emitted when a network peer has disconnected.
           *
           * @event peer:left
           *
           * @param {string} actorId - the actorId of the disconnected peer
           * @param {object} peer - information about the disconnected peer
           */
          this.emit('peer:left', actorId, peer)
        })
    }
  }

  _onExtension (actorId, peer) {
    return (name, data) => {
      switch (name) {
        case 'hypermerge':
          this._onMessage(actorId, peer, data)
          break
        default:
          this.emit('peer:extension', actorId, name, data, peer)
      }
    }
  }

  _onMessage (actorId, peer, data) {
    const msg = JSON.parse(data)

    switch (msg.type) {
      case 'FEEDS_SHARED':
        msg.keys.forEach((actorId) => {
          this._trackedFeed(actorId)
        })
        break
      default:
        this.emit('peer:message', actorId, peer, msg)
        this._handles(actorId).forEach(handle => {
          handle._message({ peer, msg })
        })
    }
  }

  // Throws an error if the Hypermerge instance isn't ready yet. Call at the top
  // of any function in which this invariant should be true.
  _ensureReady () {
    if (!this.isReady) {
      throw new Error('The Hypermerge instance is not ready yet. Use .on("ready") first.')
    }
  }
}

module.exports = Hypermerge

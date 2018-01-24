var events = require('events')
var Automerge = require('automerge')
var Multicore = require('./multicore')
var inherits = require('inherits')
var thunky = require('thunky')
var raf = require('random-access-file')
var ram = require('random-access-memory')
var toBuffer = require('to-buffer')
var {WatchableDoc} = Automerge

module.exports = Hypermerge

function Hypermerge (storage, opts) {
  if (!(this instanceof Hypermerge)) return new Hypermerge(storage, opts)
  events.EventEmitter.call(this)

  if (isObject(storage) && !storage.open) {
    // First arg doesn't look like an object that implements
    // abstract-random-access ... must be options. Default to
    // using random-access-memory
    opts = storage
    storage = ram
  }

  var self = this

  opts = opts || {}
  this.key = opts.key ? toBuffer(opts.key, 'hex') : null
  this.localKey = opts.localKey ? toBuffer(opts.localKey, 'hex') : null

  if (!storage) storage = ram
  this._storage = typeof storage === 'string' ? fileStorage : storage

  this.opts = opts

  this.multicore = new Multicore(storage, {debugLog: opts.debugLog})
  this.multicore.on('debugLog', this._debugLog.bind(this))

  this.ready = thunky(open)
  this.ready(onready)

  function onready (err) {
    if (err) return onerror(err)
    self.emit('ready')
  }

  function onerror (err) {
    if (err) self.emit('error', err)
  }

  function open (cb) {
    self.multicore.ready(() => {
      self._open(cb)
    })
  }

  function fileStorage (name) {
    return raf(name, {directory: storage})
  }
}

inherits(Hypermerge, events.EventEmitter)

Hypermerge.prototype._open = function (cb) {
  var self = this
  var source = this._createFeed(this.key, 'source')

  source.ready(function () {
    self.source = source
    self.key = source.key
    self.discoveryKey = source.discoveryKey
    self.peers = {}
    self.lastSeen = {}

    if (source.writable) {
      self.doc = new WatchableDoc(Automerge.init(self.key.toString('hex')))
      self.doc.registerHandler(self._newChanges.bind(self))
      self.previousDoc = self.doc.get()

      return self._syncToAutomerge(self.source, cb)
    }

    self.source.on('sync', self._syncToAutomerge.bind(self, self.source))

    var local = self._createFeed(self.localKey)

    local.ready(function () {
      self.local = local
      var sourceDoc = new WatchableDoc(
        Automerge.init(self.key.toString('hex'))
      )
      self.doc = new WatchableDoc(
        Automerge.init(self.local.key.toString('hex'))
      )
      self.doc.set(Automerge.merge(self.doc.get(), sourceDoc.get()))
      self.doc.registerHandler(self._newChanges.bind(self))
      self.previousDoc = self.doc.get()

      self._syncToAutomerge(self.source, () => {
        self._syncToAutomerge(self.local, cb)
      })
    })
  })
}

Hypermerge.prototype.getMissing = function (cb) {
  cb = cb || noop
  this._findMissingPeers(cb)
}

Hypermerge.prototype._findMissingPeers = function (cb) {
  const self = this
  const missingDeps = Automerge.getMissingDeps(self.doc.get())
  self._debugLog(`Missing deps before: ${JSON.stringify(missingDeps)}`)
  const missingPeers = Object.keys(missingDeps)

  connectMissingPeers(() => {
    const missingDeps = Automerge.getMissingDeps(self.doc.get())
    self._debugLog(`Missing deps after: ${JSON.stringify(missingDeps)}`)
    cb()
  })

  function connectMissingPeers (cb) {
    const key = missingPeers.pop()
    if (!key) {
      self.findingMissingPeers = false
      return cb()
    }
    self.findingMissingPeers = true
    self._debugLog(`Connecting missing peer ${key.toString('hex')}`)
    self.connectPeer(key, () => {
      self._debugLog(`Connected missing peer ${key.toString('hex')}`)
      connectMissingPeers(cb)
    })
  }
}

Hypermerge.prototype.connectPeer = function (key, cb) {
  var self = this
  var keyBuffer = toBuffer(key, 'hex')
  var keyString = keyBuffer.toString('hex')
  cb = cb || noop
  if (self.source.key.toString('hex') === keyString) {
    return cb()
  }
  if (self.local && self.local.key.toString('hex') === keyString) {
    return cb()
  }
  if (self.peers[keyString]) {
    return cb(null, self.peers[keyString])
  }
  var peer = self._createFeed(keyBuffer)
  self.peers[keyString] = peer

  self.multicore.replicateFeed(peer)
  peer.ready(function () {
    self._syncToAutomerge(peer, () => {
      peer.on('sync', self._syncToAutomerge.bind(self, peer))
      cb(null, peer)
    })
  })

  peer.on('error', function (err) {
    cb(err)
  })
}

Hypermerge.prototype._createFeed = function (key) {
  if (key) {
    if (this.local && this.local.key && this.local.key.equals(key)) {
      return this.local
    }
    if (this.source && this.source.key && this.source.key.equals(key)) {
      return this.source
    }
  }

  // var feed = this.multicore.createFeed(key, {valueEncoding: 'json'})
  var feed = this.multicore.createFeed(key)
  // feed.on('ready', () => this._debugLog(`Ready ${key && key.toString('hex')}`))
  feed.on('error', err => { this.emit('error', err) })
  /*
  feed.on('peer-add', peer => {
    this._debugLog(`peer-add ${peer.feed.key.toString('hex')}`)
  })
  feed.on('peer-remove', peer => {
    this._debugLog(`peer-remove ${peer.feed.key.toString('hex')}`)
  })
  */
  /*
  feed.on('sync', () => this._debugLog(
    `sync ${feed.key.toString('hex')} ${feed.length}`
  ))
  feed.on('append', () => this._debugLog(
    `append ${feed.key.toString('hex')} ${feed.length}`
  ))
  */

  return feed
}

Hypermerge.prototype._syncToAutomerge = function (feed, cb) {
  cb = cb || noop
  const key = feed.key.toString('hex')
  const self = this
  const prevLastSeen = self.lastSeen[key] || 0
  self.lastSeen[key] = feed.length
  const changes = []

  // self._debugLog(`_syncToAutomerge ${feed.key.toString('hex')} ${feed.length}`)
  if (prevLastSeen === self.lastSeen[key]) {
    return cb()
  }

  fetchRecords(prevLastSeen + 1, self.lastSeen[key], () => {
    self.doc.applyChanges(changes)
    cb()
  })

  function fetchRecords (from, to, cb) {
    // self._debugLog(`Fetch seq ${from}`)
    // console.log('Fetch seq', from - 1, to)
    feed.get(from - 1, (err, data) => {
      if (err) {
        console.error('Error _syncToAutomerge seq', from, err)
        return
      }
      let change
      try {
        change = JSON.parse(data.toString())
      } catch (e) {
        return cb(e)
      }
      // self._debugLog(`Fetched seq ${from}`)
      // console.log('Fetched seq', from - 1, change)
      changes.push(change)
      if (from < to) {
        fetchRecords(from + 1, to, cb)
      } else {
        cb()
      }
    })
  }
}

Hypermerge.prototype._newChanges = function (doc) {
  const changes = Automerge.getChanges(this.previousDoc, doc)
  const feed = this.local ? this.local : this.source
  const key = feed.key.toString('hex')
  changes
    .filter(change => change.actor === key)
    .filter(change => change.seq > feed.length)
    .forEach(change => {
      const {seq} = change
      feed.append(JSON.stringify(change), err => {
        if (err) {
          console.error('Error ' + seq, err)
        }
      })
    })
  this.previousDoc = this.doc.get()
}

Hypermerge.prototype._debugLog = function (message) {
  if (this.opts.debugLog) {
    this.emit('debugLog', message)
  }
}

Hypermerge.prototype.get = function () {
  return this.doc.get()
}

Hypermerge.prototype.set = function () {
  return this.doc.set()
}

Hypermerge.prototype.change = function (...args) {
  return this.doc.set(Automerge.change(this.doc.get(), ...args))
}

Hypermerge.prototype.getArchiverKey = function () {
  return this.multicore.archiver.changes.key
}

Hypermerge.prototype.joinSwarm = function (opts) {
  return this.multicore.joinSwarm(opts)
}

function isObject (val) {
  return !!val && typeof val !== 'string' && !Buffer.isBuffer(val)
}

function noop () {}

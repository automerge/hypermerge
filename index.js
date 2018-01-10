var events = require('events')
var Automerge = require('automerge')
var hypercore = require('hypercore')
var inherits = require('inherits')
var thunky = require('thunky')
var raf = require('random-access-file')
var toBuffer = require('to-buffer')
var {WatchableDoc} = Automerge

module.exports = Hypermerge

function Hypermerge (storage, key, opts) {
  if (!(this instanceof Hypermerge)) return new Hypermerge(storage, key, opts)
  events.EventEmitter.call(this)

  if (isObject(key)) {
    opts = key
    key = null
  }

  var self = this

  this.key = key ? toBuffer(key, 'hex') : null

  this._storage = typeof storage === 'string' ? fileStorage : storage

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
    self._open(cb)
  }

  function fileStorage (name) {
    return raf(name, {directory: storage})
  }
}

inherits(Hypermerge, events.EventEmitter)

Hypermerge.prototype._open = function (cb) {
  var self = this
  var source = this._createFeed(this.key, 'source')

  source.on('ready', function () {
    self.source = source
    self.key = source.key
    self.discoveryKey = source.discoveryKey
    self.peers = {}
    self.lastSeen = {}

    if (source.writable) {
      self.doc = new WatchableDoc(Automerge.init(self.key.toString('hex')))
      self.doc.registerHandler(self._newChanges.bind(self))
      self.previousDoc = self.doc.get()
      return cb()
    }

    self.source.on('sync', self._onSync.bind(self, self.source))

    var local = self._createFeed(null, 'local')

    local.on('ready', function () {
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
      cb()
    })
  })
}

Hypermerge.prototype.connectPeer = function (key, cb) {
  var self = this
  var keyBuffer = toBuffer(key, 'hex')
  var keyString = keyBuffer.toString('hex')
  this.ready(function () {
    if (self.peers[keyString]) {
      return cb(null, self.peers[keyString])
    }
    var peer = self._createFeed(keyBuffer)

    peer.on('ready', function () {
      self.peers[keyString] = peer

      peer.on('sync', self._onSync.bind(self, peer))

      cb(null, peer)
    })

    peer.on('error', function (err) {
      cb(err)
    })
  })
}

Hypermerge.prototype._createFeed = function (key, dir) {
  if (!dir) {
    dir = key.toString('hex')
    dir = 'peers/' + dir.slice(0, 2) + '/' + dir.slice(2)
  }

  if (key) {
    if (this.local && this.local.key && this.local.key.equals(key)) {
      return this.local
    }
    if (this.source && this.source.key && this.source.key.equals(key)) {
      return this.source
    }
  }

  var self = this
  var feed = hypercore(storage, key, {valueEncoding: 'json'})

  feed.on('error', onerror)

  return feed

  function onerror (err) {
    self.emit('error', err)
  }

  function storage (name) {
    return self._storage(dir + '/' + name)
  }
}

Hypermerge.prototype._onSync = function (feed) {
  var key = feed.key.toString('hex')
  var self = this
  // console.log('Jim sync', feed.key.toString('hex'))
  try {
    var prevLastSeen = self.lastSeen[key] || 0
  } catch (e) {
    console.error('Exception', e)
  }
  self.lastSeen[key] = feed.length
  for (let i = prevLastSeen + 1; i <= self.lastSeen[key]; i++) {
    // console.log('Fetch', i)
    feed.get(i - 1, (err, change) => {
      if (err) {
        console.error('Error _onSync', i, err)
        return
      }
      // console.log('Fetched', i, change)
      self.doc.applyChanges([change])
    })
  }
}

Hypermerge.prototype._newChanges = function (doc) {
  const changes = Automerge.getChanges(this.previousDoc, doc)
  const feed = this.local ? this.local : this.source
  const key = feed.key.toString('hex')
  changes
    .filter(change => change.actor === key)
    .filter(change => change.seq >= feed.length)
    .forEach(change => {
      const {seq} = change
      // console.log('Jim change', feed.length, change)
      feed.append(change, err => {
        if (err) {
          console.error('Error ' + seq, err)
        }
      })
    })
  this.previousDoc = this.doc.get()
}

Hypermerge.prototype.replicate = function (opts) {
  if (!opts) opts = {}

  opts.expectedFeeds = 1

  var self = this
  var stream = this.source.replicate(opts)

  return stream
}

function isObject (val) {
  return !!val && typeof val !== 'string' && !Buffer.isBuffer(val)
}

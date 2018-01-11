var events = require('events')
var Automerge = require('automerge')
var hypercore = require('hypercore')
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

  if (!storage) storage = ram
  this._storage = typeof storage === 'string' ? fileStorage : storage

  this.opts = opts

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

    self._onSync(self.source)

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
  cb = cb || noop
  this.ready(function () {
    if (self.peers[keyString]) {
      return cb(null, self.peers[keyString])
    }
    var peer = self._createFeed(keyBuffer)
    self.peers[keyString] = peer

    peer.on('ready', function () {
      self.emit('_connectPeer', keyString)

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

  const changes = []

  fetchRecords(prevLastSeen + 1, self.lastSeen[key], () => {
    self.doc.applyChanges(changes)
  })

  function fetchRecords(from, to, cb) {
    self._debugLog(`Fetch seq ${from}`)
    feed.get(from - 1, (err, change) => {
      if (err) {
        console.error('Error _onSync', i, err)
        return
      }
      self._debugLog(`Fetched seq ${from}`)
      // console.log('Fetched', i, change)
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
  var stream = self.source.replicate(opts)
  opts = {...opts, stream}

  if (self.local) {
    stream.expectedFeeds += 1
    self.local.replicate(opts)
  }

  Object.keys(self.peers).forEach(function (key) {
    stream.expectedFeeds += 1
    self.peers[key].replicate(opts)
  })

  const connectPeerListener = function (key) {
    stream.expectedFeeds += 1
    self.peers[key].replicate(opts)
  }

  self.on('_connectPeer', connectPeerListener)
  stream.on('close', () => {
    self._debugLog('close stream')
    self.removeListener('_connectPeer', connectPeerListener)
  })

  return stream
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

function isObject (val) {
  return !!val && typeof val !== 'string' && !Buffer.isBuffer(val)
}

function noop () {}

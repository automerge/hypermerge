var events = require('events')
// var Automerge = require('automerge')
var hypercore = require('hypercore')
var inherits = require('inherits')
var thunky = require('thunky')
var raf = require('random-access-file')
var toBuffer = require('to-buffer')

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
    cb()
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

function isObject (val) {
  return !!val && typeof val !== 'string' && !Buffer.isBuffer(val)
}

const ram = require('random-access-memory')
const HyperMerge = require('hypermerge')

require('events').EventEmitter.prototype._maxListeners = 100

module.exports = class Model {
  constructor (channelHex, nick, port, onReady) {
    this.channelHex = channelHex
    this.nick = nick

    this.hm = new HyperMerge({port, path: ram})
    .once('ready', hm => {
      hm.joinSwarm()

      if (channelHex) {
        console.log('Searching for chat channel on network...')

        // Look up the document by its hex identifier
        hm.open(channelHex)

        // Once we manage to open the document we'll get this message,
        // so we'll post a joinChannel message and call _ready.
        hm.once('document:updated', (docId, doc) => {
          this.doc = doc
          this.joinChannel()
          this._ready(onReady)
        })
      } else {
        // We're starting a new channel here, so first
        // initialize the new channel document data structure.
        this.doc = hm.create()
        this.doc = hm.change(this.doc, changeDoc => {
          changeDoc.messages = {}
        })

        // Now we post the join channel message and call _ready.
        this.joinChannel()
        this.channelHex = hm.getId(this.doc)
        this._ready()
      }
    })
  }

  joinChannel () {
    this.doc = this.hm.change(this.doc, changeDoc => {
      changeDoc.messages[Date.now()] = {
        nick: this.nick,
        joined: true
      }
    })
  }

  _ready (onReady) {
    const render = onReady({
      doc: this.doc,
      channelHex: this.channelHex,
      numConnections: this.hm.swarm.connections.length
    })

    const remoteUpdate = (id, newDoc) => {
      this.doc = newDoc
      render(this.doc)
    }

  // We merge any new documents that arrive due to events,
  // but we don't update our hypercores
    this.hm.on('document:updated', remoteUpdate)
    this.hm.on('document:ready', remoteUpdate)
  }

  addMessageToDoc (line) {
    const message = line.trim()
    if (message.length === 0) return this.doc
    this.doc = this.hm.change(this.doc, changeDoc => {
      changeDoc.messages[Date.now()] = {
        nick: this.nick,
        message: line
      }
    })
    return this.doc
  }
}

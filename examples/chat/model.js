const ram = require('random-access-memory')
const HyperMerge = require('hypermerge')
const Automerge = require('automerge')

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
        this.doc = joinChannel(hm, doc)
        _ready(hm, this.channelHex, this.doc)
      })
    } else {
      // We're starting a new channel here, so first
      // initialize the new channel document data structure.
      this.doc = hm.create()
      this.doc = hm.update(
        Automerge.change(this.doc, changeDoc => {
          changeDoc.messages = {}
        })
      )

      // Now we post the join channel message and call _ready.
      this.doc = joinChannel(hm, this.doc)

      this.channelHex = hm.getId(this.doc)
      _ready(hm, this.channelHex, this.doc)
    }
  })

    function joinChannel (hm, doc) {
      return hm.update(
      Automerge.change(doc, changeDoc => {
        changeDoc.messages[Date.now()] = {
          nick,
          joined: true
        }
      })
    )
    }

    function _ready (hm, channelHex, doc) {
      const render = onReady({
        doc,
        channelHex,
        numConnections: hm.swarm.connections.length
      })

    // We merge any new documents that arrive due to events,
    // but we don't update our hypercores
      hm.on('document:updated', remoteUpdate)
      hm.on('document:ready', remoteUpdate)

      function remoteUpdate (id, newDoc) {
        doc = newDoc
        render(doc)
      }
    }
  }

  addMessageToDoc (line) {
    const message = line.trim()
    if (message.length === 0) return this.doc
    this.doc = this.hm.update(
      Automerge.change(this.doc, changeDoc => {
        changeDoc.messages[Date.now()] = {
          nick: this.nick,
          message: line
        }
      })
    )
    return this.doc
  }
}

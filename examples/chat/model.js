const ram = require('random-access-memory')
const HyperMerge = require('hypermerge')
const {EventEmitter} = require('events')

// It's normal for a chat channel with a lot of participants
// to have a lot of connections, so increase the limit to
// avoid warnings about emitter leaks
EventEmitter.prototype._maxListeners = 100

module.exports = class Model extends EventEmitter {
  constructor ({channelHex, nick}) {
    super()
    this.channelHex = channelHex
    this.nick = nick
    this.hm = new HyperMerge({path: ram})
    this.hm.once('ready', this.setup.bind(this))
  }

  /**
   * Either create a new channel or join an existing one
   */
  setup (hm) {
    hm.joinSwarm() // Fire up the network

    if (!this.channelHex) {
      // We're starting a new channel here, so first
      // initialize the new channel document data structure.
      let doc = hm.create()
      this.channelHex = hm.getId(doc)
      doc = hm.change(doc, changeDoc => {
        changeDoc.messages = {}
      })
      this.ready(doc)
    } else {
      console.log('Searching for chat channel on network...')
      hm.open(this.channelHex)
      // hm.once('document:updated', (docId, doc) => { this.ready(doc) })
      hm.once('document:ready', (docId, doc) => { this.ready(doc) })
    }
  }

  /**
   * Post a chat message announcing someone has joined
   */
  joinChannel () {
    this.doc = this.hm.change(this.doc, changeDoc => {
      changeDoc.messages[Date.now()] = {
        nick: this.nick,
        joined: true
      }
    })
  }

  /**
   * Everything is setup, send an event to signal the UI to
   * start, and setup listeners to watch for remote document updates.
   */
  ready (doc) {
    this.doc = doc
    this.joinChannel()
    this.emit('ready', {doc, channelHex: this.channelHex})

    // We merge any new documents that arrive due to events,
    // but we don't update our hypercores
    this.hm.on('document:updated', this.remoteUpdate.bind(this))
    this.hm.on('document:ready', this.remoteUpdate.bind(this))
  }

  /**
   * Called whenever the automerge document is updated remotely.
   */
  remoteUpdate (id, doc) {
    this.doc = doc
    this.emit('updated', this.doc)
  }

  /**
   * Getter to return the number of connections for the UI
   */
  getNumConnections () {
    return this.hm.swarm.connections.length
  }

  /**
   * Called from the UI whenever somebody posts a message
   */
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

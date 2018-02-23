const ram = require('random-access-memory')
const Hypermerge = require('hypermerge')
const {EventEmitter} = require('events')

// It's normal for a chat channel with a lot of participants
// to have a lot of connections, so increase the limit to
// avoid warnings about emitter leaks
EventEmitter.prototype._maxListeners = 100

module.exports = class Channel extends EventEmitter {
  constructor ({channelKey, nick}) {
    super()
    this.channelKey = channelKey
    this.nick = nick
    this.hm = new Hypermerge({path: ram})
    this.hm.once('ready', this.setup.bind(this))
  }

  /**
   * Either create a new channel or join an existing one
   */
  setup (hm) {
    hm.joinSwarm() // Fire up the network

    if (!this.channelKey) {
      // We're starting a new channel here, so first
      // initialize the new channel document data structure.
      hm.create()
      hm.once('document:ready', (docId, doc) => {
        this.channelKey = docId
        this.doc = hm.change(doc, changeDoc => {
          changeDoc.messages = {}
        })
        this.ready(this.doc)
      })
    } else {
      console.log('Searching for chat channel on network...')
      hm.open(this.channelKey)
      hm.once('document:ready', (docId, doc) => { this.ready(doc) })
    }
  }

  /**
   * Everything is setup, send an event to signal the UI to
   * start, and setup listeners to watch for remote document updates.
   */
  ready (doc) {
    this.doc = doc
    this.joinChannel()
    this.emit('ready', this)

    // We merge any new documents that arrive due to events,
    // but we don't update our hypercores
    this.hm.on('document:updated', (docId, doc) => {
      this.doc = doc
      this.emit('updated', this)
    })
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

  /**
   * Getter to return the number of connections for the UI
   */
  getNumConnections () {
    return this.hm.swarm.connections.length
  }
}

const ram = require('random-access-memory')
const {HyperMerge} = require('hypermerge')
const Automerge = require('automerge')

require('events').EventEmitter.prototype._maxListeners = 100

const hm = new HyperMerge({path: ram})
hm.joinSwarm()

function setup (channelHex, nick, onReady) {
  if (!channelHex) {
    hm.create()
    hm.once('document:ready', doc => {
      doc = hm.update(
        Automerge.change(doc, changeDoc => {
          changeDoc.messages = {}
          changeDoc.messages[Date.now()] = {
            nick,
            joined: true
          }
        })
      )
      const channelHex = hm.getHex(doc)
      _ready(hm, channelHex, doc)
    })
  } else {
    console.log('Searching for chat channel on network...')
    hm.open(channelHex)
    hm.once('document:ready', () => {
      let doc = hm.fork(channelHex)
      const myHex = hm.getHex(doc)
      hm.share(myHex, channelHex)
      hm.once('document:ready', () => {
        doc = hm.update(
          Automerge.change(doc, changeDoc => {
            changeDoc.messages[Date.now()] = {
              nick,
              joined: true
            }
          })
        )
        _ready(hm, channelHex, doc)
      })
    })
  }

  function _ready (hm, channelHex, doc) {
    const render = onReady({
      doc,
      channelHex,
      connections: hm.swarm.connections,
      addMessageToDoc
    })

    // We merge any new documents that arrive due to events,
    // but we don't update our hypercores
    hm.on('document:updated', mergeDoc)
    hm.on('document:ready', mergeDoc)
    function mergeDoc (eventDoc) {
      doc = Automerge.merge(doc, eventDoc)
      render(doc)
    }

    // FIXME: Commit something to the document?
    hm.on('peer:joined', () => {
    })

    // This callback is supplied to the onReady callback - it is used
    // to append new chat messages to the document arriving from the UI
    function addMessageToDoc (line) {
      const message = line.trim()
      if (message.length === 0) return doc
      doc = hm.update(
        Automerge.change(doc, changeDoc => {
          changeDoc.messages[Date.now()] = {
            nick,
            message: line
          }
        })
      )
      return doc
    }
  }
}

module.exports = setup

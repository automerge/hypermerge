const ram = require('random-access-memory')
const {HyperMerge} = require('hypermerge')
const Automerge = require('automerge')

require('events').EventEmitter.prototype._maxListeners = 100

function setup (channelHex, nick, port, onReady) {
  new HyperMerge({port, path: ram})
  .once('ready', hm => {
    hm.joinSwarm()

    if (channelHex) {
      console.log('Searching for chat channel on network...')

      // Look up the document by its hex identifier
      hm.open(channelHex)

      // Once we manage to open the document we'll get this message,
      // so we'll post a joinChannel message and call _ready.
      hm.once('document:updated', (docId, doc) => {
        doc = joinChannel(hm, doc)
        _ready(hm, channelHex, doc)
      })
    } else {
      // We're starting a new channel here, so first
      // initialize the new channel document data structure.
      let doc = hm.create()
      doc = hm.update(
        Automerge.change(doc, changeDoc => {
          changeDoc.messages = {}
        })
      )

      // Now we post the join channel message and call _ready.
      doc = joinChannel(hm, doc)

      const channelHex = hm.getId(doc)
      _ready(hm, channelHex, doc)
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
      numConnections: hm.swarm.connections.length,
      addMessageToDoc
    })

    // We merge any new documents that arrive due to events,
    // but we don't update our hypercores
    hm.on('document:updated', remoteUpdate)
    hm.on('document:ready', remoteUpdate)

    function remoteUpdate (id, newDoc) {
      doc = newDoc
      render(doc)
    }

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

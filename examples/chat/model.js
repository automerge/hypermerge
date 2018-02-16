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

      hm.open(channelHex)

      hm.once('document:updated', (docId, doc) => {
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
    } else {
      let doc = hm.create()

      doc = hm.update(
        Automerge.change(doc, changeDoc => {
          changeDoc.messages = {}
          changeDoc.messages[Date.now()] = {
            nick,
            joined: true
          }
        })
      )

      const channelHex = hm.getId(doc)
      _ready(hm, channelHex, doc)
    }
  })

  function _ready (hm, channelHex, doc) {
    const render = onReady({
      doc,
      channelHex,
      connections: hm.swarm.connections,
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

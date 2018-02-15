#!/usr/bin/env node

const minimist = require('minimist')
const ram = require('random-access-memory')
const {HyperMerge} = require('hypermerge')
const Automerge = require('automerge')
const {initUI, render} = require('./ui')

require('events').EventEmitter.prototype._maxListeners = 100

const argv = minimist(process.argv.slice(2))

if (argv.help || argv._.length > 1) {
  console.log('Usage: hm-chat [--nick=<nick>] [<channel-key>]\n')
  process.exit(0)
}

if (!argv.nick) {
  const prompt = require('prompt-sync')()
  argv.nick = prompt('Enter your nickname: ')
}

function main () {
  const hm = new HyperMerge({path: ram})
  hm.joinSwarm()
  const channelHex = argv._[0]
  if (!channelHex) {
    hm.create()
    hm.once('document:ready', newDoc => {
      const myDoc = hm.update(
        Automerge.change(newDoc, doc => {
          doc.messages = {}
          doc.messages[Date.now()] = {
            nick: argv.nick,
            joined: true
          }
        })
      )
      const myHex = hm.getHex(myDoc)
      _ready(hm, myHex, myDoc)
    })
  } else {
    console.log('Searching for chat channel on network...')
    hm.open(channelHex)
    hm.once('document:ready', () => {
      let myDoc = hm.fork(channelHex)
      const myHex = hm.getHex(myDoc)
      hm.share(myHex, channelHex)
      hm.once('document:ready', () => {
        myDoc = hm.update(
          Automerge.change(myDoc, doc => {
            doc.messages[Date.now()] = {
              nick: argv.nick,
              joined: true
            }
          })
        )
        _ready(hm, channelHex, myDoc)
      })
    })
  }
}

function _ready (hm, channelHex, myDoc) {
  initUI({
    nick: argv.nick,
    channelHex,
    connections: hm.swarm.connections,
    doc: myDoc,
    postMessage: (myDoc, line) => {
      const message = line.trim()
      if (message.length === 0) return myDoc
      myDoc = hm.update(
        Automerge.change(myDoc, doc => {
          doc.messages[Date.now()] = {
            nick: argv.nick,
            message: line
          }
        })
      )
      return myDoc
    }
  })
  hm.on('peer:joined', () => {
    // FIXME: Commit something to the document?
  })
  hm.on('document:updated', mergeDoc)
  hm.on('document:ready', mergeDoc)
  function mergeDoc (doc) {
    myDoc = Automerge.merge(myDoc, doc)
    render(myDoc)
  }
}

main()

#!/usr/bin/env node

const minimist = require('minimist')
const diffy = require('diffy')({fullscreen: true})
const input = require('diffy/input')({showCursor: true})
const ram = require('random-access-memory')
const {HyperMerge} = require('hypermerge')
const Automerge = require('automerge')
const stripAnsi = require('strip-ansi')

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
  setInterval(r, 3000) // For network connection display
  hm.on('document:updated', mergeDoc)
  hm.on('document:ready', mergeDoc)
  function mergeDoc (doc) {
    myDoc = Automerge.merge(myDoc, doc)
    r()
  }
  hm.on('peer:joined', () => {
    setTimeout(() => { myDoc = hm.update(myDoc) }, 1000)
  })
  input.on('update', r)
  input.on('enter', postMessage)
  r()

  function render () {
    let output = ''
    output += `Join: npx hm-chat ${channelHex}\n`
    output += `${hm.swarm.connections.length} connections. `
    output += `Use Ctrl-C to exit.\n\n`
    let displayMessages = []
    let messages = myDoc.getIn(['messages'])
    messages = messages ? messages.toJS() : {}
    Object.keys(messages).sort().forEach(key => {
      if (key === '_objectId') return
      if (key === '_conflicts') return
      const {nick, message, joined} = messages[key]
      if (joined) {
        displayMessages.push(`${nick} has joined.`)
      } else {
        displayMessages.push(`${nick}: ${message}`)
      }
    })
    // Delete old messages
    const maxMessages = diffy.height - output.split('\n').length - 2
    displayMessages.splice(0, displayMessages.length - maxMessages)
    displayMessages.forEach(line => {
      output += stripAnsi(line).substr(0, diffy.width - 2) + '\n'
    })
    for (let i = displayMessages.length; i < maxMessages; i++) {
      output += '\n'
    }
    output += `\n[${argv.nick}] ${input.line()}`
    return output
  }

  function r () {
    diffy.render(render)
  }

  function postMessage (line) {
    const message = line.trim()
    if (message.length > 0) {
      myDoc = hm.update(
        Automerge.change(myDoc, doc => {
          doc.messages[Date.now()] = {
            nick: argv.nick,
            message: line
          }
        })
      )
    }
    r()
  }
}

main()

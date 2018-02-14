#!/usr/bin/env node

const minimist = require('minimist')
const input = require('diffy/input')({showCursor: true})
const diffy = require('diffy')({fullscreen: true})
const ram = require('random-access-memory')
const {HyperMerge} = require('../..')
const Automerge = require('automerge')
const bs58check = require('bs58check')

require('events').EventEmitter.prototype._maxListeners = 100

const argv = minimist(process.argv.slice(1), {
  boolean: ['debug', 'new-actor', 'new-channel']
})

if (argv.help || !argv.nick || argv._.length > 1) {
  // FIXME: Prompt for nick if not supplied
  console.log(
    'Usage: hm-chat --nick=<nick> [--save=<dir>] [--debug] ' +
    '[--new-channel] [<channel-key>]\n'
  )
  process.exit(0)
}

function main () {
  if (argv.save) {
    console.log('Not implemented yet')
    process.exit(1)
  } else {
    const hm = new HyperMerge({path: ram})
    hm.create({
      type: 'chat',
      nick: argv.nick
    })
    hm.once('document:ready', chatDoc => {
      chatDoc = hm.update(
        Automerge.change(chatDoc, doc => {
          doc.messages = {}
          doc.people = {}
        })
      )
      _ready(hm, chatDoc)
    })
  }
}

function _ready (hm, chatDoc) {
  hm.joinSwarm()

  input.on('update', r)
  input.on('enter', postMessage)
  r()

  function render () {
    let output = ''
    const key = Buffer.from(hm.getHex(chatDoc), 'hex')
    output += `Channel Key: ${bs58check.encode(key)}\n`
    output += `${hm.swarm.connections.length} connections. `
    output += `Use Ctrl-C to exit.\n\n`
    let displayMessages = []
    let messages = chatDoc.getIn(['messages']).toJS()
    Object.keys(messages).sort().forEach(key => {
      if (key === '_objectId') return
      if (key === '_conflicts') return
      const {nick, message} = messages[key]
      displayMessages.push(`${nick}: ${message}`)
    })
    // Delete old messages
    const maxMessages = diffy.height - 5
    displayMessages.splice(0, displayMessages.length - maxMessages)
    displayMessages.forEach(line => {
      output += line.substr(0, diffy.width - 2) + '\n'
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
      chatDoc = hm.update(
        Automerge.change(chatDoc, doc => {
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

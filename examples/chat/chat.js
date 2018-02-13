#!/usr/bin/env node

const minimist = require('minimist')
// const input = require('diffy/input')()
const diffy = require('diffy')({fullscreen: true})
// const prettyHash = require('pretty-hash')
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
  r()

  function render () {
    let output = ''
    const key = Buffer.from(hm.getHex(chatDoc), 'hex')
    output += `Key: ${key.toString('hex')}\n\n`
    output += `Channel Key: ${bs58check.encode(key)}\n\n`
    return output
  }

  function r () {
    diffy.render(render)
  }
}

main()

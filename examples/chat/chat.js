#!/usr/bin/env node

const minimist = require('minimist')
const Channel = require('./channel')
const initUI = require('./ui')

const argv = minimist(process.argv.slice(2))
if (argv.help || argv._.length > 1) {
  console.log('Usage: hm-chat --nick=<nick> [<channel-key>]\n')
  process.exit(0)
}

let nick = argv.nick
if (!argv.nick) {
  const prompt = require('prompt-sync')()
  nick = prompt('Enter your nickname: ')
}

const channelKey = argv._[0]

const channel = new Channel({channelKey, nick})
channel.once('ready', (channel) => {
  initUI(channel)
})

#!/usr/bin/env node

const minimist = require('minimist')
const Channel = require('./channel')
const {initUI, render} = require('./ui')

const argv = minimist(process.argv.slice(2))
if (argv.help || argv._.length > 1) {
  console.log('Usage: hm-chat --nick=<nick> [<channel-key>]\n')
  process.exit(0)
}

const nick = argv.nick
const channelHex = argv._[0]

const channel = new Channel({channelHex, nick})
channel.once('ready', (channel) => {
  initUI(channel)
})
channel.on('updated', channel => render(channel))

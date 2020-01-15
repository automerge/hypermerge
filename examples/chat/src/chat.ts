import Minimist from 'minimist'
import Prompt from 'prompt-sync'
import Channel from './channel'
import initUI from './ui'

const argv = Minimist(process.argv.slice(2))

if (argv.help || argv._.length > 1) {
  console.log('Usage: hm-chat --nick=<nick> [<channel-key>]\n')
  process.exit(0)
}

let nick = argv.nick
if (!argv.nick) {
  const prompt = Prompt()
  nick = prompt('Enter your nickname: ')
}

const channelKey = argv._[0]

const channel = new Channel(nick, channelKey)
channel.once('ready', () => initUI(channel))
channel.ready()

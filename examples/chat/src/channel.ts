/// <reference types="../../../src/types/hyperswarm" />

import { Repo, DocUrl } from 'hypermerge'
import { Doc } from 'automerge'
import Hyperswarm from 'hyperswarm'
import { EventEmitter } from 'events'

interface MyChannel {
  messages: {
    [time: string]: Message
  }
}

interface Message {
  nick: string
  joined?: boolean
  content?: string
}

class Channel extends EventEmitter {
  nick: string
  url: DocUrl
  swarm?: any
  doc?: Doc<MyChannel>
  repo: Repo

  constructor(nick: string, channelKey?: string) {
    super()

    // It's normal for a chat channel with a lot of participants
    // to have a lot of connections, so increase the limit to
    // avoid warnings about emitter leaks
    this.setMaxListeners(100)
    this.nick = nick
    this.swarm = Hyperswarm({ queue: { multiplex: true } })
    this.repo = new Repo({ path: this.nick, memory: true })
    this.repo.addSwarm(this.swarm, { announce: true })

    if (!channelKey) {
      this.url = this.repo.create({ messages: {} })
    } else {
      console.log(`Searching for chat channel ${channelKey} on network...`)
      this.url = channelKey as DocUrl
    }
  }

  ready() {
    this.repo.watch<MyChannel>(this.url, (state: any) => {
      this.doc = state
      this.emit('updated', this)
    })

    this.joinChannel()
  }

  joinChannel() {
    this.repo.change<MyChannel>(this.url, (state) => {
      state.messages[Date.now()] = {
        nick: this.nick,
        joined: true,
      }
    })

    this.emit('ready')
  }

  addMessageToDoc(line: string) {
    const message = line.trim()
    if (message.length > 0 && this.url) {
      this.repo.change<MyChannel>(this.url, (state) => {
        state.messages[Date.now()] = {
          nick: this.nick,
          content: line,
        }
      })
    }
  }

  getNumConnections() {
    return this.swarm.peers
  }
}

export default Channel

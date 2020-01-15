/// <reference types="../../../src/types/hyperswarm" />

import { Doc } from 'automerge'
import { EventEmitter } from 'events'
import { DocUrl, Repo } from 'hypermerge'
import Hyperswarm from 'hyperswarm'

interface ChatChannel {
  messages: {
    [time: string]: Message
  }
}

interface Message {
  content?: string
  joined?: boolean
  nick: string
}

class Channel extends EventEmitter {
  public readonly nick: string
  public readonly url: DocUrl

  private _doc?: Doc<ChatChannel>
  private repo: Repo
  private swarm?: any

  constructor(nick: string, channelKey?: string) {
    super()

    // It's normal for a chat channel with a lot of participants
    // to have a lot of connections, so increase the limit to
    // avoid warnings about emitter leaks
    this.setMaxListeners(100)
    this.nick = nick
    this.swarm = Hyperswarm({ queue: { multiplex: true } })

    // (Note that { memory: true } means none of this will be persisted to disk.)
    this.repo = new Repo({ memory: true })

    this.repo.addSwarm(this.swarm, { announce: true })

    if (!channelKey) {
      this.url = this.repo.create({ messages: {} })
    } else {
      console.log(`Searching for chat channel ${channelKey} on network...`)
      this.url = channelKey as DocUrl
    }
  }

  get doc(): Doc<ChatChannel> | undefined {
    return this._doc
  }

  public ready() {
    this.repo.watch<ChatChannel>(this.url, (state: any) => {
      this._doc = state
      this.emit('updated')
    })

    this.repo.change<ChatChannel>(this.url, (state) => {
      state.messages[Date.now()] = {
        joined: true,
        nick: this.nick,
      }
    })

    this.emit('ready')
  }

  public addMessageToDoc(line: string) {
    const message = line.trim()
    if (message.length > 0) {
      this.repo.change<ChatChannel>(this.url, (state) => {
        state.messages[Date.now()] = {
          content: message,
          nick: this.nick,
        }
      })
    }
  }

  public getNumConnections() {
    return this.swarm.peers
  }
}

export default Channel

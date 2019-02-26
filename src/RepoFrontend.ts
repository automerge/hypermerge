import Queue from "./Queue"
import * as Base58 from "bs58"
import { ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg"
import Handle from "./Handle"
import { DocFrontend } from "./DocFrontend"
import { keyPair } from "./hypercore"
import Debug from "debug"

Debug.formatters.b = Base58.encode

const log = Debug("repo:front")

export class RepoFrontend {
  toBackend: Queue<ToBackendRepoMsg> = new Queue("repo:tobackend")
  docs: Map<string, DocFrontend<any>> = new Map()

  create(): string {
    const keys = keyPair()
    const publicKey = Base58.encode(keys.publicKey)
    const secretKey = Base58.encode(keys.secretKey)
    const docId = publicKey
    const actorId = publicKey
    const doc = new DocFrontend(this.toBackend, { actorId, docId })
    this.docs.set(docId, doc)
    this.toBackend.push({ type: "CreateMsg", publicKey, secretKey })
    return publicKey
  }

  open<T>(id: string): Handle<T> {
    const doc: DocFrontend<T> = this.docs.get(id) || this.openDocFrontend(id)
    return doc.handle()
  }

  private openDocFrontend<T>(id: string): DocFrontend<T> {
    const doc: DocFrontend<T> = new DocFrontend(this.toBackend, { docId: id })
    this.toBackend.push({ type: "OpenMsg", id })
    this.docs.set(id, doc)
    return doc
  }

  subscribe = (subscriber: (message: ToBackendRepoMsg) => void) => {
    this.toBackend.subscribe(subscriber)
  }

  receive = (msg: ToFrontendRepoMsg) => {
    const doc = this.docs.get(msg.id)!
    switch (msg.type) {
      case "PatchMsg": {
        doc.patch(msg.patch)
        break
      }
      case "ActorIdMsg": {
        doc.setActorId(msg.actorId)
        break
      }
      case "ReadyMsg": {
        doc.init(msg.actorId, msg.patch)
        break
      }
    }
  }
}

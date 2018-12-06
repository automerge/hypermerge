
import Queue from "./Queue"
import * as Base58 from "bs58"
import MapSet from "./MapSet"
import * as crypto from "hypercore/lib/crypto"
import { ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg"
import Handle from "./Handle"
import { ChangeFn } from "automerge/frontend"
import { DocFrontend } from "./DocFrontend"
import { clock2strs, Clock, clockDebug } from "./Clock"
import Debug from "debug"
import { validateID } from "./Metadata"

Debug.formatters.b = Base58.encode

const log = Debug("repo:front")

export class RepoFrontend {
  toBackend: Queue<ToBackendRepoMsg> = new Queue("repo:tobackend")
  docs: Map<string, DocFrontend<any>> = new Map()
  readFiles: MapSet<string,(data: Uint8Array) => void> = new MapSet()
  file?: Uint8Array

  create = ( init?: any ): string => {
    const keys = crypto.keyPair()
    const publicKey = Base58.encode(keys.publicKey)
    const secretKey = Base58.encode(keys.secretKey)
    const docId = publicKey
    const actorId = publicKey
    const doc = new DocFrontend(this, { actorId, docId })
    this.docs.set(docId, doc)
    this.toBackend.push({ type: "CreateMsg", publicKey, secretKey })
    if (init) {
      doc.change( state => {
        for (let key in init) {
          state[key] = init[key]
        }
      })
    }
    return publicKey
  }

  change = <T>(id: string, fn: ChangeFn<T>) => {
    this.open<T>(id).change(fn)
  }


  merge = (id: string, target: string ) => {
    this.doc(target, (doc, clock) => {
      const actors = clock2strs(clock!)
      this.toBackend.push({ type: "MergeMsg", id, actors })
    })
  }

  writeFile = <T>(data: Uint8Array) : string => {
    const keys = crypto.keyPair()
    const publicKey = Base58.encode(keys.publicKey)
    const secretKey = Base58.encode(keys.secretKey)
    this.toBackend.push(data)
    this.toBackend.push({ type: "WriteFile", publicKey, secretKey })
    return publicKey
  }

  readFile = <T>(id: string, cb: (data: Uint8Array) => void) : void => {
    validateID(id)
    this.readFiles.add(id, cb)
    this.toBackend.push({ type: "ReadFile", id })
  }

  fork = (id: string ) : string => {
    const fork = this.create()
    this.merge(fork, id)
    return fork
  }

  follow = (id: string, target: string) => {
    validateID(id)
    this.toBackend.push({ type: "FollowMsg", id, target })
  }

  watch = <T>(id: string, cb: (val: T, clock? : Clock, index?: number) => void) : Handle<T> => {
    const handle = this.open<T>(id)
    handle.subscribe( cb )
    return handle
  }

  doc = <T>(id: string, cb?: (val: T, clock? : Clock) => void): Promise<T> => {
    validateID(id)
    return new Promise((resolve) => {
      const handle = this.open<T>(id)
      handle.subscribe( (val, clock) => {
        resolve(val)
        if (cb) cb(val,clock)
        handle.close()
      })
    })
  }

  open = <T>(id: string): Handle<T> => {
    validateID(id)
    const doc: DocFrontend<T> = this.docs.get(id) || this.openDocFrontend(id)
    return doc.handle()
  }

  debug(id :string) {
    validateID(id)
    const doc = this.docs.get(id)
    const short = id.substr(0,5)
    if (doc === undefined) {
      console.log(`doc:frontend undefined doc=${short}`)
    } else {
      console.log(`doc:frontend id=${short}`)
      console.log(`doc:frontend clock=${clockDebug(doc.clock)}`)
    }

    this.toBackend.push({ type: "DebugMsg", id })
  }

  private openDocFrontend<T>(id: string): DocFrontend<T> {
    const doc: DocFrontend<T> = new DocFrontend(this, { docId: id })
    this.toBackend.push({ type: "OpenMsg", id })
    this.docs.set(id, doc)
    return doc
  }

  subscribe = (subscriber: (message: ToBackendRepoMsg) => void) => {
    this.toBackend.subscribe(subscriber)
  }

  receive = (msg: ToFrontendRepoMsg) => {
    if (msg instanceof Uint8Array) {
      this.file = msg
    } else {
      const doc = this.docs.get(msg.id)!
      switch (msg.type) {
        case "ReadFileReply": {
          this.readFiles.get(msg.id).forEach(cb => cb(this.file!))
          this.readFiles.delete(msg.id)
          delete this.file
          break
        }
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
}

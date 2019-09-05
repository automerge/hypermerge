import Queue from './Queue'
import * as Base58 from 'bs58'
import MapSet from './MapSet'
import { ToBackendQueryMsg, ToBackendRepoMsg, ToFrontendRepoMsg } from './RepoMsg'
import { Handle } from './Handle'
import { Doc, Patch } from 'automerge/frontend'
import * as Frontend from 'automerge/frontend'
import { DocFrontend } from './DocFrontend'
import { clock2strs, Clock, clockDebug } from './Clock'
import * as Keys from './Keys'
import Debug from 'debug'
import { PublicMetadata, validateDocURL, validateURL } from './Metadata'
import { DocUrl, DocId, ActorId, toDocUrl, HyperfileId, HyperfileUrl, rootActorId } from './Misc'
import FileServerClient from './FileServerClient'

Debug.formatters.b = Base58.encode

const log = Debug('repo:front')

export interface DocMetadata {
  clock: Clock
  history: number
  actor?: ActorId
}

export interface ProgressEvent {
  actor: ActorId
  index: number
  size: number
  time: number
}

let msgid = 1

export class RepoFrontend {
  toBackend: Queue<ToBackendRepoMsg> = new Queue('repo:front:toBackendQ')
  docs: Map<DocId, DocFrontend<any>> = new Map()
  cb: Map<number, (reply: any) => void> = new Map()
  msgcb: Map<number, (patch: Patch) => void> = new Map()
  readFiles: MapSet<HyperfileId, (data: Uint8Array, mimeType: string) => void> = new MapSet()
  files = new FileServerClient()

  setFileServerPath(path: string) {
    this.files.serverPath = path
  }

  create = <T>(init?: T): DocUrl => {
    const { publicKey, secretKey } = Keys.create()
    const docId = publicKey as DocId
    const actorId = rootActorId(docId)
    const doc = new DocFrontend(this, { actorId, docId })

    this.docs.set(docId, doc)
    this.toBackend.push({ type: 'CreateMsg', publicKey, secretKey: secretKey! })

    if (init) {
      doc.change((state) => {
        for (let key in init) {
          state[key] = init[key]
        }
      })
    }
    return toDocUrl(docId)
  }

  change = <T>(url: DocUrl, fn: (state: T) => void) => {
    this.open<T>(url).change(fn)
  }

  meta = (url: DocUrl | HyperfileUrl, cb: (meta: PublicMetadata | undefined) => void): void => {
    const { id, type } = validateURL(url)
    this.queryBackend(
      { type: 'MetadataMsg', id: id as DocId | HyperfileId },
      (meta: PublicMetadata | undefined) => {
        if (meta) {
          const doc = this.docs.get(id as DocId)
          if (doc && meta.type === 'Document') {
            meta.actor = doc.actorId
            meta.history = doc.history
            meta.clock = doc.clock
          }
        }
        cb(meta)
      }
    )
  }

  meta2 = (url: DocUrl | HyperfileUrl): DocMetadata | undefined => {
    const { id, type } = validateURL(url)
    const doc = this.docs.get(id as DocId)
    if (!doc) return
    return {
      actor: doc.actorId,
      history: doc.history,
      clock: doc.clock,
    }
  }

  merge = (url: DocUrl, target: DocUrl) => {
    const id = validateDocURL(url)
    validateDocURL(target)
    this.doc(target, (doc, clock) => {
      const actors = clock2strs(clock!)
      this.toBackend.push({ type: 'MergeMsg', id, actors })
    })
  }

  fork = (url: DocUrl): DocUrl => {
    validateDocURL(url)
    const fork = this.create()
    this.merge(fork, url)
    return fork
  }

  /*
  follow = (url: string, target: string) => {
    const id = validateDocURL(url);
    this.toBackend.push({ type: "FollowMsg", id, target });
  };
*/

  watch = <T>(url: DocUrl, cb: (val: T, clock?: Clock, index?: number) => void): Handle<T> => {
    validateDocURL(url)
    const handle = this.open<T>(url)
    handle.subscribe(cb)
    return handle
  }

  message = (url: DocUrl, contents: any): void => {
    const id = validateDocURL(url)
    this.toBackend.push({ type: 'DocumentMessage', id, contents })
  }

  doc = <T>(url: DocUrl, cb?: (val: T, clock?: Clock) => void): Promise<T> => {
    validateDocURL(url)
    return new Promise((resolve) => {
      const handle = this.open<T>(url)
      handle.subscribe((val, clock) => {
        resolve(val)
        if (cb) cb(val, clock)
        handle.close()
      })
    })
  }

  materialize = <T>(url: DocUrl, history: number, cb: (val: T) => void) => {
    const id = validateDocURL(url)
    const doc = this.docs.get(id)
    if (doc === undefined) {
      throw new Error(`No such document ${id}`)
    }
    if (history < 0 && history >= doc.history) {
      throw new Error(`Invalid history ${history} for id ${id}`)
    }
    this.queryBackend({ type: 'MaterializeMsg', history, id }, (patch: Patch) => {
      const doc = Frontend.init({ deferActorId: true }) as Doc<T>
      cb(Frontend.applyPatch(doc, patch))
    })
  }

  queryBackend(query: ToBackendQueryMsg, cb: (arg: any) => void) {
    msgid += 1 // global counter
    const id = msgid
    this.cb.set(id, cb)
    this.toBackend.push({ type: 'Query', id, query })
  }

  open = <T>(url: DocUrl): Handle<T> => {
    const id = validateDocURL(url)
    const doc: DocFrontend<T> = this.docs.get(id) || this.openDocFrontend(id)
    return doc.handle()
  }

  debug(url: DocUrl) {
    const id = validateDocURL(url)
    const doc = this.docs.get(id)
    const short = id.substr(0, 5)
    if (doc === undefined) {
      console.log(`doc:frontend undefined doc=${short}`)
    } else {
      console.log(`doc:frontend id=${short}`)
      console.log(`doc:frontend clock=${clockDebug(doc.clock)}`)
    }

    this.toBackend.push({ type: 'DebugMsg', id })
  }

  private openDocFrontend<T>(id: DocId): DocFrontend<T> {
    const doc: DocFrontend<T> = new DocFrontend(this, { docId: id })
    this.toBackend.push({ type: 'OpenMsg', id })
    this.docs.set(id, doc)
    return doc
  }

  subscribe = (subscriber: (message: ToBackendRepoMsg) => void) => {
    this.toBackend.subscribe(subscriber)
  }

  close = (): void => {
    this.toBackend.push({ type: 'CloseMsg' })
    this.docs.forEach((doc) => doc.close())
    this.docs.clear()
  }

  destroy = (url: DocUrl): void => {
    const id = validateDocURL(url)
    this.toBackend.push({ type: 'DestroyMsg', id })
    const doc = this.docs.get(id)
    if (doc) {
      // doc.destroy()
      this.docs.delete(id)
    }
  }

  /*
  handleReply = (id: number, reply: ToFrontendReplyMsg) => {
    const cb = this.cb.get(id)!
    switch (reply.type) {
      case "MaterializeReplyMsg": {
        cb(reply.patch);
        break;
      }
    }
    this.cb.delete(id)
  }
*/

  receive = (msg: ToFrontendRepoMsg) => {
    switch (msg.type) {
      case 'PatchMsg': {
        const doc = this.docs.get(msg.id)
        if (doc) {
          doc.patch(msg.patch, msg.synced, msg.history)
        }
        break
      }
      case 'Reply': {
        const id = msg.id
        //          const reply = msg.reply
        // this.handleReply(id,reply)
        const cb = this.cb.get(id)!
        cb(msg.payload)
        this.cb.delete(id)!
        break
      }
      case 'ActorIdMsg': {
        const doc = this.docs.get(msg.id)
        if (doc) {
          doc.setActorId(msg.actorId)
        }
        break
      }
      case 'ReadyMsg': {
        const doc = this.docs.get(msg.id)
        if (doc) {
          doc.init(msg.synced, msg.actorId, msg.patch, msg.history)
        }
        break
      }
      case 'ActorBlockDownloadedMsg': {
        const doc = this.docs.get(msg.id)
        if (doc) {
          const progressEvent = {
            actor: msg.actorId,
            index: msg.index,
            size: msg.size,
            time: msg.time,
          }
          doc.progress(progressEvent)
        }
        break
      }
      case 'DocumentMessage': {
        const doc = this.docs.get(msg.id)
        if (doc) {
          doc.messaged(msg.contents)
        }
        break
      }
      case 'FileServerReadyMsg':
        this.setFileServerPath(msg.path)
        break
    }
  }
}

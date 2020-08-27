import Debug from './Debug'
import { RepoFrontend } from './RepoFrontend'
import { DocUrl, withoutQuery, isString, isDocUrl, BaseUrl } from './Misc'
import { Handle } from './Handle'
import { isHyperfileUrl } from './FileStore'
import * as TraverseLogic from './TraverseLogic'
import { Doc } from 'cambria-automerge'

const log = Debug('Crawler')

export class Crawler {
  repo: RepoFrontend
  seen: Set<string> = new Set()
  handles: Map<DocUrl, Handle<any>> = new Map()

  constructor(repo: RepoFrontend) {
    this.repo = repo
  }

  crawl(url: DocUrl) {
    log(`Crawling from root ${url}`)
    this.onUrl(url)
  }

  onUrl = (urlVal: BaseUrl) => {
    const url = withoutQuery(urlVal)
    if (this.seen.has(url)) return
    log(`Crawling ${url}`)

    if (isDocUrl(url)) {
      const handle = this.repo.open(url, undefined, false)
      this.seen.add(url)
      this.handles.set(url, handle)
      setImmediate(() => handle.subscribe(this.onDocumentUpdate))
    } else if (isHyperfileUrl(url)) {
      this.seen.add(url)
      setImmediate(() => this.repo.files.header(url))
    }
  }

  onDocumentUpdate = (doc: Doc<any>) => {
    const urls = TraverseLogic.iterativeDfs<BaseUrl>(isHypermergeUrl, doc)
    urls.forEach(this.onUrl)
  }

  close() {
    this.handles.forEach((handle) => handle.close())
    this.handles.clear()
    this.seen.clear()
  }
}

function isHypermergeUrl(val: unknown): boolean {
  if (!isString(val)) return false
  return isDocUrl(val) || isHyperfileUrl(val)
}

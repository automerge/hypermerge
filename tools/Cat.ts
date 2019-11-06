import { Repo, DocUrl } from '../src'
import Hyperswarm from 'hyperswarm'

const url = process.argv[2] as DocUrl

if (url === undefined) {
  console.log('Usage: cat <doc_url>')
  process.exit()
}

const repo = new Repo({ memory: true })

repo.setSwarm(Hyperswarm())

console.log('Watching document:', url)

repo.watch(url, (doc) => {
  console.log(doc)
})

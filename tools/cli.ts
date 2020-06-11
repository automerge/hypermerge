import fs from 'fs'
import { Repo, HyperfileUrl } from '../src'
import mime from 'mime-types'

import Hyperswarm from 'hyperswarm'

const { program } = require('commander')

program.version('1.0').option('-r, --repo <path>', "specify the repo's location", '.data')

program
  .command('store <file>')
  .description('copy a file into a hyperfile')
  .option('-m, --mime-type', 'override the mime-type')
  .action(cp)

program
  .command('cat <url>')
  .description('read a hyperfile out to stdout')
  .action(cat)

program.parse(process.argv)

function repoSetup(repoPath: string) {
  if (!fs.existsSync(repoPath + '/ledger')) {
    console.log('No repo found: ' + repoPath)
    process.exit()
  }

  const repo = new Repo({ path: repoPath })

  // ARGH
  repo.startFileServer('stupid-socket-path.sock')

  console.log('going to', repoPath)
  repo.setSwarm(Hyperswarm())
  return repo
}

function cp(file: string, options: any) {
  console.log(options)

  const repo = repoSetup(program.repo)

  if (!fs.existsSync(file)) {
    console.log('No file found: ' + file)
    process.exit()
  }

  const mimeType = mime.lookup(file) || program.mimeType || 'application/octet-stream'

  console.log('file', file, 'mimetype', mimeType)
  const fileStream = fs.createReadStream(file)
  console.log('writing to', repo.files)
  repo.files.write(fileStream, mimeType).then(({ url }) => {
    console.log('written')
    repo.files.read(url).then((header) => {
      console.log(url)
      console.log(header)
      //repo.close()
      setTimeout(() => {
        process.exit()
        // I need this to make sure the ledger finishes its append
        // get repo.close() to work and flush correctly?
      }, 1000)
    })
  })
}

async function cat(url: HyperfileUrl, options: any) {
  console.log(options)

  const repo = repoSetup(program.repo)

  const [header, stream] = await repo.files.read(url)
  // Read and disply the file data on console
  console.log(header.mimeType)
  stream.on('data', function(chunk) {
    console.log(chunk.toString())
  })

  //repo.close()
  setTimeout(() => {
    process.exit()
    // I need this to make sure the ledger finishes its append
    // get repo.close() to work and flush correctly?
  }, 1000)
}

setTimeout(() => {}, 50000) // dont exit yet

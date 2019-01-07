
import fs from "fs"
import { Repo } from "../src"
const raf: Function = require("random-access-file")
const id = process.argv[2]
const _path = process.argv[3]
const path = _path || ".data"

if (id === undefined) {
  console.log("Usage: cat DOC_ID [REPO]")
  process.exit()
}

if (_path && !fs.existsSync(_path + "/ledger")) {
  console.log("No repo found: " + _path)
  process.exit()
}

setTimeout(() => {}, 50000)

const repo = new Repo({ path, storage: raf })

repo.meta(id,(meta) => {
  console.log(meta)
  if (!meta) {
    console.log("No such doc or file in repo")
    process.exit()
  } else if (meta.type === "Document") {
    repo.doc(id, (doc,c) => {
      console.log("Clock", c)
      console.log(doc)
      process.exit()
    })
  } else if (meta.type === "File") {
    repo.readFile(id, (data,mimeType) => {
      console.log("hyperfile://" + id)
      console.log("File Size: ", data.length)
      console.log("File Type: ", mimeType)
      process.exit()
    })
  }
})

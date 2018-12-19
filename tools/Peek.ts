
import fs from "fs"
import { Repo } from "../src"
const raf: Function = require("random-access-file")
const path = process.argv[2]
const id = process.argv[3]

if (path === undefined || id === undefined) {
  console.log("Usage: peek REPO_DIR DOC_ID")
  process.exit()
}

if (!fs.existsSync(path + "/ledger")) {
  console.log("No repo found: " + path)
  process.exit()
}

if (!fs.existsSync(path + "/" + id)) {
  console.log("No doc found in repo: " + id)
  process.exit()
}

setTimeout(() => {}, 50000)

const repo = new Repo({ path, storage: raf })
repo.doc(id).then((doc) => {
  console.log(doc)
  process.exit()
})

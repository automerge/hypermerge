import test from "tape";
//import { Repo, RepoBackend, RepoFrontend } from "../src"
import { Clock, union, cmp, gte} from "../src/Clock"
//import { expectDocs } from "./misc"

//const ram: Function = require("random-access-memory")

test("Clock compare", (t) => {
  const c1 = { a: 100, b: 100, c: 100 }
  const c2 = { a: 101, b: 101, c: 101 }
  const c3 = { a: 101, b: 100, c: 100 }
  const c4 = { a: 100, b: 100, c: 100, d: 1 }
  const c5 = { a: 101, b: 100, c: 100, d: 1 }
  const c6 = { a: 99, b: 101, c: 100, d: 1 }

  t.equal( cmp(c1,c1), "EQ")
  t.equal( cmp(c1,c2), "LT")
  t.equal( cmp(c2,c1), "GT")
  t.equal( cmp(c1,c3), "LT")
  t.equal( cmp(c3,c1), "GT")
  t.equal( cmp(c1,c4), "LT")
  t.equal( cmp(c4,c1), "GT")
  t.equal( cmp(c1,c5), "LT")
  t.equal( cmp(c5,c1), "GT")
  t.equal( cmp(c1,c6), "CONCUR")
  t.equal( cmp(c6,c1), "CONCUR")
  t.end()
})

test("Clock union", (t) => {
  const c1 = { a: 100, b: 200, c: 300 }
  const c2 = { b: 10, c: 2000, d: 50 }
  const c3 = union(c1,c2)
  const c4 = union(c2,c1)
  const answer = { a: 100, b:200, c:2000, d: 50}
  t.deepEqual(c3,answer, "union test 1")
  t.deepEqual(c4,answer, "union test 1")
  t.deepEqual(c3,c4, "union is communitive")
  t.end()
})


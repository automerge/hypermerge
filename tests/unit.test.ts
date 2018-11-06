import test from "tape";
import { Repo } from "../src"

test("Math test", (t) => {
  const repo = new Repo()
  const doc = repo.createDocument()
  let i = 0
  doc.on("doc", (d) => {
    console.log("DOC",d)
    i += 1
    if (i == 3) {
      t.equal(d.foo, "bar")
      t.end();
    }
  })
  doc.change(doc => {
    doc.foo = "bar"
  })
});

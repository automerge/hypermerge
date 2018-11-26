
import test from "tape";
import { clock, ClockSet } from "../src/ClockSet"
import { Clock } from "automerge/frontend"

test("Simple clockSet with no collisions", (t) => {
  const c = new ClockSet()
  c.add("d1", { "foo": 1, "bar": 2 })
  c.add("d2", { "foo": 2, "bar": 3 })
  t.equal( c.seq("d1","foo"), 1)
  t.equal( c.seq("d2","foo"), 2)
  t.equal( c.seq("d1","bar"), 2)
  t.equal( c.seq("d2","bar"), 3)
  t.equal( c.seq("d2","baz"), 0)
  t.equal( c.seq("d3","foo"), 0)
  t.end();
});

test("Simple clockSet with collisions", (t) => {
  const c = new ClockSet()
  c.add("d1", clock(["foo:1", "bar:10", "aaa:10" ]))
  c.add("d1", { "foo": 10, "bar": 1, "bbb": 10 })
  t.equal( c.seq("d1","foo"), 10)
  t.equal( c.seq("d1","bar"), 10)
  t.equal( c.seq("d1","aaa"), 10)
  t.equal( c.seq("d1","bbb"), 10)
  t.end();
});

test("Test clockSet::(docMap | docSeq) with collisions and Infinity", (t) => {
  const c = new ClockSet()
  c.add("d1", clock([ "foo:1", "bar:10", "aaa:10"]))
  c.add("d1", clock(["foo", "bar:1" ]))
  c.add("d2", clock([ "foo:1", "bar:11" ]))
  c.add("d2", clock([ "foo:11", "bar:1", "bbb:11" ]))
  t.deepEqual( c.docMap("foo"), { "d1": Infinity, "d2": 11 } )
  t.deepEqual( c.docMap("bar"), { "d1": 10, "d2": 11 } )
  t.deepEqual( c.docMap("aaa"), { "d1": 10 } )
  t.deepEqual( c.docMap("bbb"), { "d2": 11 } )
  t.equal( c.docSeq("foo","d1"), Infinity)
  t.equal( c.docSeq("foo","d2"), 11)
  t.equal( c.seq("d2","foo"), 11)
  t.end();
});


test("Test clockSet::docsWith", (t) => {
  const c = new ClockSet()
  c.add("d1", clock([ "foo:1", "bar:10", "aaa:10" ]))
  c.add("d1", clock([ "foo", "bar:1" ]))
  c.add("d2", clock([ "foo:1", "bar:11" ]))
  c.add("d2", clock([ "foo:11", "bar:1", "bbb:11" ]))
  t.deepEqual(c.docsWith("bbb", 10), ["d2"])
  t.deepEqual(c.docsWith("bbb", 11), ["d2"])
  t.deepEqual(c.docsWith("bbb", 12), [])
  t.deepEqual(c.docsWith("foo", 11).sort(), ["d1","d2"])
  t.deepEqual(c.docsWith("foo", 12), ["d1"])
  t.end();
});

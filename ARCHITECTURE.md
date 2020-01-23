# ARCHITECTURE

Hypermerge is a distributed document store. It draws inspiration from databases like CouchDB and
PouchDB. It is particularly well-suited to funcional reactive programming languages and environments,
but it does not prefer or require any particular external framework.

The core concept in Hypermerge is a document. You can think of a document as a JSON document that
has an unchangeable name which can be used to collaborate on that document from any computer in the
world.

The core API for a hypermerge document has two-parts:

- a subscription to watch document state
  `repo.watch(documentUrl, (doc) => {})`
- a change function to update your local state (and publish the changes) to other readers
  `repo.change(documentUrl, (doc) => { doc.title = "Green Eggs and Ham"})`

Importantly, repo.change does not return the new state of the document! Document changes flow back
through the hypermerge update mechanism and are delivered as a new state from the watch function.
This is very natural in a React or Elm-like system but can be surprising to new users, particularly
because Automerge (the underlying CRDT) returns new results immediately.

## How it Works

Under the hood, a hypermerge document is built up by applying a series of changes generated on
different clients. For example, if you set a title in a change block, hypermerge will record a
change, noting both the state of the document at that change and the change you made. This is
conceptually similar to a patch in a version control system. It will also include metadata about the
state of the document at the time the change was made which ensures changes are applied consistently
and conflicts can be detected.

Every time you open a hypermerge document, the system replays all the logs of changes from every
client to recreate the document state. This can be slow and expensive for large documents, but has
excellent history-preserving properties and guarantees clients can always return to earlier states
or merge new changes as they arrive.

These changes are stored and replicated over the network using a peer-to-peer system called
hyperswarm along with a few novel extensions. Hypermerge uses a combination of strategies to
discover and connect to peer systems that we'll discuss later, but in general clients connect
directly and exchange data with a minimum of involvement of other servers.

### Storage

All of a client's changes to a particular hypermerge document are recorded in a hypercore. A
hypercore is an append-only log that includes a few extra properties that make it convenient to
replicate to other machines, particularly using `hyperswarm`.

First, every block in the hypercore is signed by a private key held by the original author, and the
unique name of the hypercore is the corresponding public key. This ensures that any client can test
whether a particular change is authentic. Second, each block includes a checksum of the previous
block. This allows the client to ensure that the log they are receiving is complete and uncorrupted.
Finally, the log includes special Merkle Tree blocks which allow for sparse replication. A client
can download a small number of additional validation blocks and still be certain the blocks they
downloaded are correct.

It is possible to store hypercores in a variety of ways, but in hypermerge each hypercore is stored
in several files as a directory on disk.

All these hypercores (one per author for every document) can lead to a huge amount of files to open
for larger repositories. This is a major performance challenge.

### Peering & Replication

Each running hypermerge client has a repository of its own data. (These are not currently safe to
share between clients on the same computer, so each application must have its own.) For every
hypercore in that repository, a hypermerge instance will advertise in a variety of ways that it can
serve requests for that data. Once a client responds to an advertisement and a connection is made,
the two peers will swap lists of hypercores they both know about and begin replicating all missing
changes. The list exchange protocol uses a form of the socialist millionaire's protocol, ensuring
that clients can only recognize each other's shared data and don't leak the identity of other data.

#### Advertising / Discovery

There are two main strategies used by hyperswarm for discovery. For local connections, hyperswarm
broadcasts mDNS messages to a local multicast address. This strategy works well on many wifi networks
and can enable totally internet-free local connectivity but breaks down in environments like cafes,
public libraries, and corporate networks where peer-to-peer network traffic is viewed as a security
risk due to a history of accidental or malicious data sharing.

Over the broader internet, hyperswarm clients discover one another using a DHT. A full discussion of
DHTs is beyond the scope of this document, but the approximate design is of a lossy, decentralized
database. Each client tells other peer nodes what data they know about and can route requests on
behalf of other peers.

#### Connectivity

Within an open home wireless network or between peers with at least one public IPv4 addresses direct
TCP connections are simple and reliable. Unfortunately, due to the prevalance of NAT routers today,
it is not possible to directly address other computers. Hyperswarm uses UTP, a UDP-based protocol
inherited from the BitTorrent client uTorrent, to create a reliable NAT-traversing connection. NAT
traversal is a complex and frustrating topic, and even the state of the art falls short of perfect
connectivity, but with the help of a third peer to handle "introductions" in the peering process, UTP
represents probably the most robust NAT traversal solution available in environments where clients
cannot reconfigure network infrastructure (using, for example uPNP).

There is interesting potential in exploring additional discovery and connectivity strategies,
including BLE, Wifi Direct, ultrasonic discovery, and traffic relay approaches including centralized
server infrastructure or more dynamically allocated peer nodes.

#### Replication

Each document is made of a set of hypercores, one for each participating client's changes. The names
of each client's hypercores are written into a SQLite "feed store" and these names are hashed and
used as the published "discovery key". When clients connect to one another, they swap encrypted
lists and lengths of all the feeds they know about (in their feed store), then check for matches.
Because hypercores are single-client and append-only, clients can easily calculate, request and
offer any data they might be missing or able to share. This feed synchronization happens over a
multiplexed data channel (and lacks prioritization, so can be problematically laggy in large repo
synchronization!)

### Changes, Vector Clocks, and Conflicts

Hypermerge is built on top of automerge, a JSON-like document CRDT. Automerge represents documents
as highly granular changes with logical-time information to preserve ordering. Automerge has several
data types built into it. The most important two are `map` and `array`, which together can provide a
JSON-like experience, but Automerge also includes special support other types including numeric
counters, and text.

Automerge instruments all changes to a document structure using Javascript proxy objects to record
the changes made within a `change()` block. This approach, as opposed to diffing before/after states
on a document allows for very accurate detection of changes that might include intermediate states
like removing and adding a new entry at a particular position in a list (as opposed to updating its
value), and is part of a _conflict avoidance_ strategy.

#### Conflict Avoidance through Specificity

Contrasting automerge with a text-based version control system like git, automerge stores more
information about the intention behind a change than git (which compares output plain text). A
simple demonstration of the difference is to imagine merging two users' changes to a trivial JSON
file stored in git versus automerge.

Before: `{ lunchIdeas: [ "tacos", "pizza" ]}`
Alice: `{ lunchIdeas: [ "tacos", "pizza", "waffles" ]}`
Bob: `{ lunchIdeas: [ "tacos", "pizza", "pho" ]}`

Git's merging model views the two users' documents as completely different and asks the user to pick
an outcome. Even if the clients put one value on each line, both `"waffles"` and `"pho"` will appear
to be a conflict. Automerge would generally capture these changes as something approximately like:

Alice: `{ author: alice, seq: 1, change: {insert: "waffles", after: "pizza"}}`
Bob: `{ author: bob, seq: 1, change: {insert: "pho", after: "pizza"}}`

_NB: the actual change is quite similar to this but uses stronger, more stable identifiers._

#### Conflict Avoidance through Visibility Vectors

Consider the example from the previous section. Both Alice and Bob are inserting data into the array
in a way which is non-conflicting. Let's assume now they're making a decision instead:

Before: `{ lunchIdeas: [ "tacos", "pizza", "waffles", "pho" ], decision: null }`
Alice: `{ lunchIdeas: [ "tacos", "pizza", "waffles", "pho" ], decision: "pizza" }`
Bob: `{ lunchIdeas: [ "tacos", "pizza", "waffles", "pho" ], decision: "waffles" }`

Is this a conflict? In human terms, probably. Alice and Bob have both decided to go different places
for lunch. In data terms it's ambiguous what order to apply the data. Did Alice see Bob's change and
decide to overrule it, or did both of them make the suggestion independently?

Automerge includes a "visibility vector" for changes which allows clients to detect whether there
was a natural ordering to apply. Let's take a look:

Alice: `{ author: alice, seq: 1, change: {set: "decision", to: "pizza", visible: [before: 1, bob: 1]}}`
Bob: `{ author: bob, seq: 1, change: {set: "decision", to: "waffles", visible: [before: 1]}}`

In this case, we can see that Alice was _aware_ of Bob's value and chose to change it anyway. We can
safely apply her change after Bob's and conclude that she must have convinced Bob to go to lunch.

#### Conflict Resolution

Last, let's consider the case where it is truly ambiguous what order to apply changes using the same
example but with different visibility:

Alice: `{ author: alice, seq: 1, change: {set: "decision", to: "pizza", visible: [before: 1]}}`
Bob: `{ author: bob, seq: 1, change: {set: "decision", to: "waffles", visible: [before: 1]}}`

Here, we have no "right" answer. Alice and Bob both have made changes without the other's knowledge
and now as they synchronize data we have to decide what to do. Importantly, there isn't a _right_
answer here. Different systems resolve this in different ways. Some require clients to implement
custom conflict resolution functions, but this is difficult to do consistently and correctly. Some
systems make every value within the system a "multivalue". At any point a

# TODO

- Encrypted fields & crawling, and boxes.
- "Radical mandatory collaboration."
- Fork & follow.
- Access to history.

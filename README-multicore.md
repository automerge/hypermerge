# Multicore

Multicore is a system for managing and organizing multiple hypercores and connecting them to the
peer-to-peer swarm

See also: [hypercore-archiver](https://github.com/mafintosh/hypercore-archiver)

We may not need multicore if hypercore-archiver does what we need.

## Synopsis

``` js
// FIXME: Put some js code snippets here
```

## Concepts

### Hypercore archive

Can store many hypercores, all in a single directory on disk. Alternatively, can be stored in-memory.

### Discoverables

Two possible implementations - empty hypercore or hypercoreless. Can be connected to a replication set. A swarm adapter will advertise available discoverables using `discovery-swarm`.

### Replication Set

Combine several hypercores in the database into a replication set.

### Feeds

Individual hypercore instances from the hypercore archive. Can either be:

* Writable (private key is stored locally)
* Read-only (private key is not available locally)


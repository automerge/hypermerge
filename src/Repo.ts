import { Options, RepoBackend } from "./RepoBackend";
import { RepoFrontend, DocMetadata } from "./RepoFrontend";
import { Handle } from "./Handle";
import { Clock } from "./Clock";
import { ChangeFn } from "automerge/frontend";

interface Swarm {
  join(dk: Buffer): void;
  leave(dk: Buffer): void;
  on: Function;
}

export class Repo {
  front: RepoFrontend;
  back: RepoBackend;
  id: Buffer;
  stream: (opts: any) => any;
  create: (init?: any) => string;
  open: <T>(id: string) => Handle<T>;
  follow: (id: string, target: string) => void;
  replicate: (swarm: Swarm) => void;

  fork: (id: string) => string;
  watch: <T>(
    id: string,
    cb: (val: T, clock?: Clock, index?: number) => void
  ) => Handle<T>;
  doc: <T>(id: string, cb?: (val: T, clock?: Clock) => void) => Promise<T>;
  merge: (id: string, target: string) => void;
  change: <T>(id: string, fn: ChangeFn<T>) => void;
  writeFile: <T>(data: Uint8Array, mimeType: string) => string;
  readFile: <T>(id: string, cb: (data: Uint8Array, mimeType: string) => void) => void;
  materialize: <T>(id: string, seq: number, cb: (val: T) => void) => void;
  meta: (id: string) => DocMetadata | undefined;

  constructor(opts: Options) {
    this.front = new RepoFrontend();
    this.back = new RepoBackend(opts);
    this.front.subscribe(this.back.receive);
    this.back.subscribe(this.front.receive);
    this.id = this.back.id;
    this.stream = this.back.stream;
    this.create = this.front.create;
    this.open = this.front.open;
    this.meta = this.front.meta;
    this.follow = this.front.follow;
    this.doc = this.front.doc;
    this.fork = this.front.fork;
    this.change = this.front.change;
    this.readFile = this.front.readFile;
    this.writeFile = this.front.writeFile;
    this.watch = this.front.watch;
    this.merge = this.front.merge;
    this.replicate = this.back.replicate;
    this.materialize = this.front.materialize;
  }
}

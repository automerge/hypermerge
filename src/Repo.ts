import { Options, RepoBackend } from "./RepoBackend";
import { RepoFrontend, DocMetadata } from "./RepoFrontend";
import { Handle } from "./Handle";
import { PublicMetadata } from "./Metadata";
import { Clock } from "./Clock";

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
  create: <T>(init?: T) => string;
  open: <T>(id: string) => Handle<T>;
  destroy: (id: string) => void;
  follow: (id: string, target: string) => void;
  replicate: (swarm: Swarm) => void;

  fork: (id: string) => string;
  watch: <T>(
    id: string,
    cb: (val: T, clock?: Clock, index?: number) => void
  ) => Handle<T>;
  doc: <T>(id: string, cb?: (val: T, clock?: Clock) => void) => Promise<T>;
  merge: (id: string, target: string) => void;
  change: <T>(id: string, fn: (state:T) => void) => void;
  writeFile: <T>(data: Uint8Array, mimeType: string) => string;
  readFile: <T>(id: string, cb: (data: Uint8Array, mimeType: string) => void) => void;
  materialize: <T>(id: string, seq: number, cb: (val: T) => void) => void;
  meta: (id: string, cb: (meta: PublicMetadata | undefined) => void) => void;
  close: () => void;

  constructor(opts: Options) {
    this.front = new RepoFrontend();
    this.back = new RepoBackend(opts);
    this.front.subscribe(this.back.receive);
    this.back.subscribe(this.front.receive);
    this.id = this.back.id;
    this.stream = this.back.stream;
    this.create = this.front.create;
    this.open = this.front.open;
    this.destroy = this.front.destroy;
    this.meta = this.front.meta;
    this.follow = this.front.follow;
    this.doc = this.front.doc;
    this.fork = this.front.fork;
    this.close = this.front.close;
    this.change = this.front.change;
    this.readFile = this.front.readFile;
    this.writeFile = this.front.writeFile;
    this.watch = this.front.watch;
    this.merge = this.front.merge;
    this.replicate = this.back.replicate;
    this.materialize = this.front.materialize;
  }
}

import { Clock, Doc, ChangeFn } from "automerge/frontend";
import { RepoFrontend, ProgressEvent } from "./RepoFrontend";

export class Handle<T> {
  id: string = "";
  state: Doc<T> | null = null;
  clock: Clock | null = null;
  subscription?: (item: Doc<T>, clock?: Clock, index?: number) => void;
  progressSubscription?: (event: ProgressEvent) => void;
  private counter: number = 0;
  private repo: RepoFrontend;

  constructor(repo: RepoFrontend) {
    this.repo = repo;
  }

  fork(): string {
    return this.repo.fork(this.id);
  }

  merge(other: Handle<T>): this {
    this.repo.merge(this.id, other.id);
    return this;
  }

  push = (item: Doc<T>, clock: Clock) => {
    this.state = item;
    this.clock = clock;
    if (this.subscription) {
      this.subscription(item, clock, this.counter++);
    }
  };

  pushProgress = (progress: ProgressEvent) => {
    if (this.progressSubscription) {
      this.progressSubscription(progress)
    }
  }

  once = (
    subscriber: (doc: Doc<T>, clock?: Clock, index?: number) => void
  ): this => {
    this.subscribe((doc: Doc<T>, clock?: Clock, index?: number) => {
      subscriber(doc, clock, index);
      this.close();
    });
    return this;
  };

  subscribe = (
    subscriber: (doc: Doc<T>, clock?: Clock, index?: number) => void
  ): this => {
    if (this.subscription) {
      throw new Error("only one subscriber for a doc handle");
    }

    this.subscription = subscriber;

    if (this.state != null && this.clock != null) {
      subscriber(this.state, this.clock, this.counter++);
    }
    return this;
  };

  subscribeProgress = (
    subscriber: (event: ProgressEvent) => void
  ): this => {
    if (this.progressSubscription) {
      throw new Error("only one progress subscriber for a doc handle")
    }
    
    this.progressSubscription = subscriber
  
    return this
  }

  close = () => {
    this.subscription = undefined;
    this.state = null;
    this.cleanup();
  };

  debug() {
    this.repo.debug(this.id);
  }

  cleanup = () => {};

  changeFn = (fn: ChangeFn<T>) => {};

  change = (fn: ChangeFn<T>): this => {
    this.changeFn(fn);
    return this;
  };
}

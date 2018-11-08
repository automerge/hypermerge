/// <reference types="node" />
import { Options, RepoBackend } from "./RepoBackend";
import { RepoFrontend } from "./RepoFrontend";
import Handle from "./Handle";
interface Swarm {
    join(dk: Buffer): void;
    leave(dk: Buffer): void;
    on: Function;
}
export declare class Repo {
    front: RepoFrontend;
    back: RepoBackend;
    id: Buffer;
    stream: (opts: any) => any;
    constructor(opts: Options);
    create(): string;
    open<T>(id: string): Handle<T>;
    replicate(swarm: Swarm): void;
}
export {};

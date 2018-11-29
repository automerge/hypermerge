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
    create: () => string;
    open: <T>(id: string) => Handle<T>;
    state: <T>(id: string) => Promise<T>;
    replicate: (swarm: Swarm) => void;
    constructor(opts: Options);
}
export {};

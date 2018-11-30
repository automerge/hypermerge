import Queue from "./Queue";
import { ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg";
import Handle from "./Handle";
import { DocFrontend } from "./DocFrontend";
import { Clock } from "./Clock";
export declare class RepoFrontend {
    toBackend: Queue<ToBackendRepoMsg>;
    docs: Map<string, DocFrontend<any>>;
    create: (init?: any) => string;
    merge: (id: string, target: string) => void;
    fork: (id: string) => string;
    follow: (id: string, target: string) => void;
    watch: <T>(id: string, cb: (val: T, clock?: Clock | undefined, index?: number | undefined) => void) => Handle<T>;
    doc: <T>(id: string, cb?: ((val: T, clock?: Clock | undefined) => void) | undefined) => Promise<T>;
    open: <T>(id: string) => Handle<T>;
    debug(id: string): void;
    private openDocFrontend;
    subscribe: (subscriber: (message: ToBackendRepoMsg) => void) => void;
    receive: (msg: ToFrontendRepoMsg) => void;
}

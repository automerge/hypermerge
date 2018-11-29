import Queue from "./Queue";
import { ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg";
import Handle from "./Handle";
import { DocFrontend } from "./DocFrontend";
import { Clock } from "./Clock";
export declare class RepoFrontend {
    toBackend: Queue<ToBackendRepoMsg>;
    docs: Map<string, DocFrontend<any>>;
    create: () => string;
    open: <T>(id: string) => Handle<T>;
    state: <T>(id: string) => Promise<T>;
    debug(id: string): void;
    fork: (clock: Clock) => string;
    follow: (id: string, target: string) => void;
    merge: (id: string, clock: Clock) => void;
    private openDocFrontend;
    subscribe: (subscriber: (message: ToBackendRepoMsg) => void) => void;
    receive: (msg: ToFrontendRepoMsg) => void;
}

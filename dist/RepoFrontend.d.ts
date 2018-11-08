import Queue from "./Queue";
import { ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg";
import Handle from "./Handle";
import { DocFrontend } from "./DocFrontend";
export declare class RepoFrontend {
    toBackend: Queue<ToBackendRepoMsg>;
    docs: Map<string, DocFrontend<any>>;
    create(): string;
    open<T>(id: string): Handle<T>;
    private openDocFrontend;
    subscribe: (subscriber: (message: ToBackendRepoMsg) => void) => void;
    receive: (msg: ToFrontendRepoMsg) => void;
}

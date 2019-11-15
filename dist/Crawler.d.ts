/// <reference types="automerge" />
import { RepoFrontend } from './RepoFrontend';
import { DocUrl, BaseUrl } from './Misc';
import { Handle } from './Handle';
export declare class Crawler {
    repo: RepoFrontend;
    seen: Set<string>;
    handles: Map<DocUrl, Handle<any>>;
    constructor(repo: RepoFrontend);
    crawl(url: DocUrl): void;
    onUrl: (urlVal: BaseUrl) => void;
    onDocumentUpdate: (doc: import("automerge").FreezeObject<any>) => void;
    close(): void;
}

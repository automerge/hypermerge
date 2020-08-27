import { RepoFrontend } from './RepoFrontend';
import { DocUrl, BaseUrl } from './Misc';
import { Handle } from './Handle';
import { Doc } from 'cambria-automerge';
export declare class Crawler {
    repo: RepoFrontend;
    seen: Set<string>;
    handles: Map<DocUrl, Handle<any>>;
    constructor(repo: RepoFrontend);
    crawl(url: DocUrl): void;
    onUrl: (urlVal: BaseUrl) => void;
    onDocumentUpdate: (doc: Doc<any>) => void;
    close(): void;
}

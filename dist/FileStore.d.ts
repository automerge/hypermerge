/// <reference types="node" />
import { HyperfileUrl } from './Misc';
import { Readable } from 'stream';
import FeedStore from './FeedStore';
import Queue from './Queue';
export interface Header {
    type: 'File';
    url: HyperfileUrl;
    bytes: number;
    mimeType: string;
}
export default class FileStore {
    private store;
    writeLog: Queue<Header>;
    constructor(store: FeedStore);
    header(url: HyperfileUrl): Promise<Header>;
    read(url: HyperfileUrl): Promise<Readable>;
    write(mimeType: string, length: number, stream: Readable): Promise<Header>;
}
export declare function isHyperfileUrl(url: string): url is HyperfileUrl;

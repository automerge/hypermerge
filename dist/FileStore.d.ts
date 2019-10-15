/// <reference types="node" />
import { HyperfileUrl } from './Misc';
import { Readable } from 'stream';
import FeedStore from './FeedStore';
import Queue from './Queue';
export declare const MAX_BLOCK_SIZE: number;
export interface Header {
    url: HyperfileUrl;
    size: number;
    blocks: number;
    mimeType: string;
    sha256: string;
}
export default class FileStore {
    private feeds;
    writeLog: Queue<Header>;
    constructor(store: FeedStore);
    header(url: HyperfileUrl): Promise<Header>;
    read(url: HyperfileUrl): Promise<Readable>;
    write(stream: Readable, mimeType: string): Promise<Header>;
}
export declare function isHyperfileUrl(url: string): url is HyperfileUrl;

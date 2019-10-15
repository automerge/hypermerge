/// <reference types="node" />
import { Readable } from 'stream';
import { HyperfileUrl } from './Misc';
import { Header } from './FileStore';
export default class FileServerClient {
    serverPath?: string;
    setServerPath(path: string): void;
    write(stream: Readable, mimeType: string): Promise<Header>;
    header(url: HyperfileUrl): Promise<Header>;
    read(url: HyperfileUrl): Promise<[Header, Readable]>;
}

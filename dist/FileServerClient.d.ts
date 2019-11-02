/// <reference types="node" />
import * as http from 'http';
import { Readable } from 'stream';
import { HyperfileUrl } from './Misc';
import { Header } from './FileStore';
export default class FileServerClient {
    serverPath?: string;
    agent: http.Agent;
    constructor();
    setServerPath(path: string): void;
    write(stream: Readable, mimeType: string): Promise<Header>;
    header(url: HyperfileUrl): Promise<Header>;
    read(url: HyperfileUrl): Promise<[Header, Readable]>;
    private request;
}

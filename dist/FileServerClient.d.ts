/// <reference types="node" />
import * as http from 'http';
import { Readable } from 'stream';
import { HyperfileUrl } from './Misc';
import { Header } from './FileStore';
export default class FileServerClient {
    serverPath: Promise<string>;
    agent: http.Agent;
    setServerPath: (path: string) => void;
    constructor();
    write(stream: Readable, mimeType: string): Promise<Header>;
    header(url: HyperfileUrl): Promise<Header>;
    read(url: HyperfileUrl): Promise<[Header, Readable]>;
    private request;
}

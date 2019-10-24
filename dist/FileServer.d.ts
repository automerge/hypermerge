import FileStore from './FileStore';
export interface HostAndPort {
    host: string;
    port: number;
}
export default class FileServer {
    private files;
    private http;
    constructor(store: FileStore);
    listen(pathOrAddress: string | HostAndPort): void;
    isListening(): boolean;
    close(): Promise<void>;
    private onConnection;
    private sendCode;
    private upload;
    private writeHeaders;
}

import FileStore from './FileStore';
export interface HostAndPort {
    host: string;
    port: number;
}
export default class FileServer {
    private files;
    private http;
    constructor(store: FileStore);
    listen(pathOrAddress: string | HostAndPort): Promise<void>;
    isListening(): boolean;
    close(): Promise<void>;
    private onConnection;
    /**
     * Handles incoming connections, and can respond by throwing FileServerError.
     */
    private onConnectionUnsafe;
    private upload;
    private sendHeaders;
}

import FileStore from './FileStore';
export default class FileServer {
    private files;
    private http;
    constructor(store: FileStore);
    listen(path: string): void;
    isListening(): boolean;
    close(): Promise<void>;
    private onConnection;
    private sendCode;
    private upload;
    private writeHeaders;
}

import FileStore from './FileStore';
export default class FileServer {
    private store;
    private http;
    constructor(store: FileStore);
    listen(path: string): void;
    isListening(): boolean;
    close(): Promise<void>;
    private onConnection;
    private upload;
    private stream;
}

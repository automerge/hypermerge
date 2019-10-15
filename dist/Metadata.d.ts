/// <reference types="node" />
import Queue from './Queue';
import { Clock } from './Clock';
import { DocUrl, DocId, ActorId, BaseUrl, BaseId, HyperfileId, HyperfileUrl } from './Misc';
export declare function cleanMetadataInput(input: any): MetadataBlock | undefined;
export declare function filterMetadataInputs(input: any[]): MetadataBlock[];
export interface UrlInfo {
    id: BaseId;
    buffer: Buffer;
    type: string;
}
interface FileBlock {
    id: HyperfileId;
    bytes: number;
    mimeType: string;
}
export declare type MetadataBlock = FileBlock;
export declare function isValidID(id: BaseId): id is BaseId;
export declare function validateURL(urlString: BaseUrl | BaseId): UrlInfo;
export declare function validateFileURL(urlString: HyperfileUrl | HyperfileId): HyperfileId;
export declare function validateDocURL(urlString: DocUrl | DocId): DocId;
export declare class Metadata {
    private files;
    private mimeTypes;
    readyQ: Queue<() => void>;
    private writable;
    private ready;
    private replay;
    private ledger;
    private join;
    constructor(storageFn: Function, joinFn: (id: ActorId) => void);
    private loadLedger;
    private batchAdd;
    private writeThrough;
    private append;
    private addBlock;
    isWritable(actorId: ActorId): boolean;
    setWritable(actor: ActorId, writable: boolean): void;
    addFile(hyperfileUrl: HyperfileUrl, bytes: number, mimeType: string): void;
    addBlocks(blocks: MetadataBlock[]): void;
    isFile(id: HyperfileId | DocId): id is HyperfileId;
    isDoc(id: DocId | HyperfileId): id is DocId;
    bench(msg: string, f: () => void): void;
    fileMetadata(id: HyperfileId): {
        type: string;
        bytes: number;
        mimeType: string;
    };
}
export declare type PublicMetadata = PublicDocMetadata | PublicFileMetadata;
export declare type PublicDocMetadata = {
    type: 'Document';
    clock: Clock;
    history: number;
    actor: ActorId | undefined;
    actors: ActorId[];
};
export declare type PublicFileMetadata = {
    type: 'File';
    bytes: number;
    mimeType: string;
};
export {};

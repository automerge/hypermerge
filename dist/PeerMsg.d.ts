import { RemoteMetadata } from './Metadata';
import { DocId } from './Misc';
export declare type PeerMsg = RemoteMetadata | DocumentMsg;
interface DocumentMsg {
    type: 'DocumentMessage';
    id: DocId;
    contents: any;
}
export {};

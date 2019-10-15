import { DocId } from './Misc';
import * as Clock from './Clock';
export declare type PeerMsg = DocumentMsg | CursorMsg;
interface DocumentMsg {
    type: 'DocumentMessage';
    id: DocId;
    contents: any;
}
interface CursorMsg {
    type: 'CursorMessage';
    cursors: {
        docId: DocId;
        cursor: Clock.Clock;
    }[];
    clocks: {
        docId: DocId;
        clock: Clock.Clock;
    }[];
}
export {};

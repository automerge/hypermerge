import { Clock } from "automerge/backend";
export declare function clock(input: string | string[]): Clock;
export declare function clock2strs(clock: Clock): string[];
export declare class ClockSet {
    private docActorSeq;
    private actorDocSeq;
    add(doc: string, val: Clock): void;
    seq(doc: string, actor: string): number;
    docSeq(actor: string, doc: string): number;
    docsWith(actor: string, seq: number): string[];
    clock(doc: string): Clock;
    docMap(actor: string): Clock;
    has(doc: string, clock: Clock): Boolean;
}

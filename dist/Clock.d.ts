import { ActorId } from './Misc';
export interface Clock {
    [actorId: string]: number;
}
export declare type CMP = 'GT' | 'LT' | 'CONCUR' | 'EQ';
export declare function gte(a: Clock, b: Clock): boolean;
export declare function cmp(a: Clock, b: Clock): CMP;
export declare function clockActorIds(clock: Clock): ActorId[];
export declare function strs2clock(input: string | string[]): Clock;
export declare function clock2strs(clock: Clock): string[];
export declare function clockDebug(c: Clock): string;
export declare function equivalent(c1: Clock, c2: Clock): boolean;
export declare function union(c1: Clock, c2: Clock): Clock;
export declare function addTo(acc: Clock, clock: Clock): void;
export declare function intersection(c1: Clock, c2: Clock): Clock;

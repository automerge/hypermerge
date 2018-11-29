export interface Clock {
    [actorId: string]: number;
}
export declare function clockDebug(c: Clock): string;
export declare function equivalent(c1: Clock, c2: Clock): boolean;
export declare function union(c1: Clock, c2: Clock): Clock;
export declare function intersection(c1: Clock, c2: Clock): Clock;

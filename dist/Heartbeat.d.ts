export interface Handlers {
    onBeat: () => void;
    onTimeout: () => void;
}
export default class Heartbeat {
    ms: number;
    interval: Interval;
    timeout: Timeout;
    beating: boolean;
    constructor(ms: number, { onBeat, onTimeout }: Handlers);
    start(): this;
    stop(): this;
    bump(): void;
}
export declare class Interval {
    ms: number;
    onInterval: () => void;
    constructor(ms: number, onInterval: () => void);
    start(): void;
    stop(): void;
}
export declare class Timeout {
    ms: number;
    onTimeout: () => void;
    constructor(ms: number, onTimeout: () => void);
    start(): void;
    stop(): void;
    bump(): void;
}

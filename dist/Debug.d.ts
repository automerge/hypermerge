import Debug, { IDebugger } from 'debug';
export { IDebugger };
export declare const log: Debug.IDebugger;
declare const _default: (namespace: string) => Debug.IDebugger;
export default _default;
export declare const trace: (label: string) => <T>(x: T, ...args: any[]) => T;
export declare function assignGlobal(objs: {
    [name: string]: any;
}): void;

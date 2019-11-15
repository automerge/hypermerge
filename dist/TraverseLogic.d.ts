export declare const WARNING_STACK_SIZE = 2000;
export interface SelectFn {
    (obj: unknown): boolean;
}
export declare function iterativeDfs<T>(select: SelectFn, root: unknown): T[];

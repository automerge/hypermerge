import { FeedId } from './FeedStore';
import { Key, PublicKey, DiscoveryKey, DiscoveryId, PublicId, EncodedKeyId } from './Keys';
export { DiscoveryId };
export declare type RepoId = PublicId & {
    __repoId: true;
};
export declare type DocId = PublicId & {
    __docId: true;
};
export declare type ActorId = FeedId & {
    __actorId: true;
};
export declare type HyperfileId = FeedId & {
    __hyperfileId: true;
};
export declare type BaseUrl = string & {
    __baseUrl: true;
};
export declare type DocUrl = BaseUrl & {
    __docUrl: true;
};
export declare type HyperfileUrl = BaseUrl & {
    __hyperfileUrl: true;
};
export declare function decodeId(id: EncodedKeyId): Key;
export declare function encodeRepoId(repoKey: PublicKey): RepoId;
export declare function encodeDocId(actorKey: PublicKey): DocId;
export declare function encodeActorId(actorKey: PublicKey): ActorId;
export declare function encodeHyperfileId(hyperfileKey: PublicKey): HyperfileId;
export declare function toDocUrl(docId: DocId): DocUrl;
export declare function toHyperfileUrl(hyperfileId: HyperfileId): HyperfileUrl;
export declare function toDiscoveryId(id: PublicId): DiscoveryId;
export declare function toDiscoveryKey(id: PublicId): DiscoveryKey;
export declare function rootActorId(docId: DocId): ActorId;
export declare function hyperfileActorId(hyperfileId: HyperfileId): ActorId;
export declare function isBaseUrl(str: BaseUrl | EncodedKeyId): str is BaseUrl;
export declare function joinSets<T>(sets: Set<T>[]): Set<T>;
export declare function ID(_id: string): string;
export declare function notEmpty<TValue>(value: TValue | null | undefined): value is TValue;
export declare function getOrCreate<K extends Object, V>(map: WeakMap<K, V>, key: K, create: (key: K) => V): V;
export declare function getOrCreate<K, V>(map: Map<K, V>, key: K, create: (key: K) => V): V;
/**
 * The returned promise resolves after the `resolver` fn is called `n` times.
 * Promises the last value passed to the resolver.
 */
export declare function createMultiPromise<T>(n: number, factory: (resolver: (value: T) => void, rejector: (err: Error) => void) => void): Promise<T>;
export declare function toIpcPath(path: string): string;

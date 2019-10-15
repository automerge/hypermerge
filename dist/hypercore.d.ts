import { Feed } from 'hypercore';
import { ActorId } from './Misc';
export declare function readFeed<T>(id: ActorId | 'ledger', feed: Feed<T>, cb: (data: T[]) => void): void;

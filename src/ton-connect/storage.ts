import {IStorage} from '@tonconnect/sdk';
import { redisClient } from '../storage';

export class TonConnectStorage implements IStorage {
    constructor(private readonly chatId: number) {
    }

    private getKey(key: string): string {
        return this.chatId.toString() + key;
    }

    async removeItem(key: string): Promise<void> {
        await redisClient.del(this.getKey(key));
    }

    async setItem(key: string, value: string): Promise<void> {
        await redisClient.set(this.getKey(key), value);
    }

    async getItem(key: string): Promise<string | null> {
        return (await redisClient.get(this.getKey(key))) || null;
    }
}


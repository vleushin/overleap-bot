import { createClient } from 'redis';

export const redisClient = createClient({ url: process.env.REDIS_URL });

export async function initRedisClient(): Promise<void> {
    await redisClient.connect();
}

redisClient.on('error', err => console.log('Redis Client Error', err));
initRedisClient();

const userIdToWalletKey = 'user_id_to_wallet_map';
const userIdToPriceKey = 'user_id_to_price_map';
const usernameToUserIdKey = 'username_to_user_id_map';

class OverleapStorage {
    async getCount(): Promise<number> {
        return redisClient.hLen(userIdToWalletKey);
    }

    async getUserPrice(userId: string): Promise<string | undefined> {
        return redisClient.hGet(userIdToPriceKey, String(userId));
    }

    async setUserPrice(userId: string, price: string): Promise<number> {
        return redisClient.hSet(userIdToPriceKey, String(userId), price);
    }

    async findUserIdByUsername(username: string): Promise<string | undefined> {
        return redisClient.hGet(usernameToUserIdKey, username.toLowerCase());
    }

    async findWalletByUserId(userId: number): Promise<string | undefined> {
        return redisClient.hGet(userIdToWalletKey, String(userId));
    }

    async register(userId: string, username: string, wallet: string): Promise<void> {
        await redisClient.hSet(userIdToWalletKey, String(userId), wallet);
        if (username) {
            await redisClient.hSet(usernameToUserIdKey, username.toLowerCase(), userId);
        }
    }
}

export const overleapStorage = new OverleapStorage();

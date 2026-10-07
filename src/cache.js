const { createClient } = require("redis");

let redisClient = null;
let redisAvailable = false;
let warned = false;

async function connectRedis() {
    if (!process.env.REDIS_URL) {
        console.log("Redis not configured - cache disabled");
        return;
    }

    redisClient = createClient({ url: process.env.REDIS_URL });

    redisClient.on("error", (error) => {
        redisAvailable = false;
        if (!warned) {
            console.warn(`Redis unavailable - cache disabled: ${error.message}`);
            warned = true;
        }
    });

    try {
        await redisClient.connect();
        redisAvailable = true;
        console.log("Redis connected");
    } catch (error) {
        redisAvailable = false;
        console.warn(`Redis unavailable - continuing without cache: ${error.message}`);
    }
}

async function disconnectRedis() {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
    }
}

async function getCache(key) {
    if (!redisAvailable) return null;
    try {
        return await redisClient.get(key);
    } catch (error) {
        console.warn(`Redis GET failed: ${error.message}`);
        return null;
    }
}

async function setCache(key, value, ttl = 60) {
    if (!redisAvailable) return false;
    try {
        await redisClient.set(key, value, { EX: ttl });
        return true;
    } catch (error) {
        console.warn(`Redis SET failed: ${error.message}`);
        return false;
    }
}

async function deleteCache(key) {
    if (!redisAvailable) return false;
    try {
        await redisClient.del(key);
        return true;
    } catch (error) {
        console.warn(`Redis DELETE failed: ${error.message}`);
        return false;
    }
}

function isRedisAvailable() {
    return redisAvailable;
}

module.exports = {
    connectRedis,
    disconnectRedis,
    getCache,
    setCache,
    deleteCache,
    isRedisAvailable
};

let redisClient = null;

async function connectRedis() {

    // Redis is completely disabled
    if (process.env.CACHE_ENABLED !== "true") {
        console.log("Redis cache disabled");
        return null;
    }

    // Only load Redis when it is actually enabled
    const { createClient } = require("redis");

    redisClient = createClient({
        url: process.env.REDIS_URL
    });

    redisClient.on("error", (error) => {
        console.error("Redis error:", error.message);
    });

    try {
        await redisClient.connect();

        console.log("Redis connected");

        return redisClient;

    } catch (error) {

        console.error("Redis unavailable. Continuing without cache.");

        redisClient = null;

        return null;
    }
}

function getRedisClient() {
    return redisClient;
}

module.exports = {
    connectRedis,
    getRedisClient
};
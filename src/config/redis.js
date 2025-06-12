// src/config/redis.js
require('dotenv').config(); // Load environment variables

const redis = require('redis');

let redisClient = null; // Initialize as null

/**
 * Connects to Redis and returns the client instance.
 * @returns {Promise<redis.RedisClientType>} A Promise that resolves with the connected Redis client.
 */
async function connectRedis() {
    if (redisClient && redisClient.isReady) {
        // If client already exists and is ready, return it
        return redisClient;
    }

    try {
        redisClient = redis.createClient({
            url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
        });

        redisClient.on('error', err => {
            console.error('Redis Client Error:', err);
            // Decide how to handle this: maybe reconnect, or just log
            // For now, re-throwing during initial connect in server.js, but
            // for runtime errors, you might handle differently.
        });

        await redisClient.connect(); // Connect the client
        console.log('Connected to Redis!');
        return redisClient;

    } catch (error) {
        console.error('Failed to connect to Redis:', error.message);
        throw error; // Re-throw to propagate the error and stop server startup if critical
    }
}

/**
 * Returns the connected Redis client instance.
 * Throws an error if the client is not yet initialized or connected.
 * @returns {redis.RedisClientType} The Redis client instance.
 */
function getRedisClient() {
    if (!redisClient || !redisClient.isReady) {
        // It's critical that connectRedis() is awaited before this is called in the main flow
        throw new Error('Redis client not initialized or not connected. Call connectRedis() first.');
    }
    return redisClient;
}

// Export the functions
module.exports = {
    connectRedis, // <-- New exported function for initial connection
    getRedisClient // <-- Existing function to get the client after connection
};

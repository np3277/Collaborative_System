// src/config/database.js
require('dotenv').config(); // Ensure .env is loaded for DB credentials

const pgp = require('pg-promise')({
    /* Initialization Options */
    capSQL: true // Capitalize SQL keywords for better readability in logs
});

// Database connection details from environment variables
const cn = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: false 
    
};

// Create a database instance
const db = pgp(cn);

/**
 * Connects to the PostgreSQL database and logs connection status.
 * This is now an exported function.
 */
async function connectDb() {
    try {
        await db.connect(); // Test the connection
        console.log('PostgreSQL database connection established successfully.');
        // No need to return anything, just ensure connection is tested
    } catch (error) {
        console.error('Error connecting to PostgreSQL database:', error.message);
        throw error; // Re-throw to propagate the error and stop server startup if critical
    }
}

// Export the database instance for direct queries and the connectDb function
module.exports = {
    db,
    connectDb // Export the function
};

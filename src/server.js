// src/server.js
require('dotenv').config(); // Load environment variables from .env
const app = require('./app'); // Your Express app
const { connectDb } = require('./config/database'); // Database connection utility
// Import socketHandler which now has an async init function
const socketHandler = require('./websocket/socketHandler');

const PORT = process.env.PORT || 3000;

/**
 * Asynchronous function to start the server and connect all necessary services.
 */
async function startServer() {
    try {
        // 1. Connect to PostgreSQL Database
        await connectDb();
        console.log('Connected to PostgreSQL database.');

        // 2. Start the HTTP server
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        // 3. Initialize Socket.IO (which now handles its own Redis connection internally)
        // Await the async init function to ensure Socket.IO and its Redis adapter are ready
        await socketHandler.init(server);
        // The success message for Socket.IO adapter connection is now handled inside socketHandler.init

    } catch (error) {
        // Log and exit if any critical service fails to connect
        console.error('Failed to start server:', error);
        process.exit(1); // Exit the process with an error code
    }
}

// Call the async function to start the application
startServer();

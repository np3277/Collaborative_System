// src/websocket/socketHandler.js
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { connectRedis } = require('../config/redis'); // Import connectRedis for async connection
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');

let io;

/**
 * Initializes Socket.IO with the HTTP server and Redis adapter.
 * This function is now asynchronous to ensure Redis is connected before proceeding.
 * @param {import('http').Server} httpServer - The HTTP server instance.
 */
async function init(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: "*", // Allow all origins for development
            methods: ["GET", "POST"]
        }
    });

    try {
        // Ensure Redis client is connected before creating the adapter
        const redisClient = await connectRedis(); // Await the connection

        // Use the connected client for both publishing and subscribing
        const pubClient = redisClient;
        const subClient = pubClient.duplicate();

        // Ensure the subscriber client also connects before using the adapter
        await subClient.connect();

        io.adapter(createAdapter(pubClient, subClient));
        console.log('Socket.IO adapter connected to Redis.');

    } catch (err) {
        console.error('Failed to connect Socket.IO adapter to Redis:', err);
        throw err; // Re-throw the error to propagate
    }

    // Socket.IO connection event
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);

        /**
         * Event: 'join_form'
         * Authenticates the user with JWT and joins them to a form room.
         * Broadcasts the initial form data to the client.
         * Payload: { shareCode: string, token: string }
         */
        socket.on('join_form', async ({ shareCode, token }) => {
            if (!shareCode || !token) {
                socket.emit('form_error', { message: 'Share code and authentication token are required.' });
                return;
            }

            try {
                const user = jwt.verify(token, JWT_SECRET);
                socket.user = user;

                const form = await Form.findByShareCode(shareCode);
                if (!form) {
                    socket.emit('form_error', { message: 'Form not found with this share code.' });
                    return;
                }

                // Leave any previously joined rooms
                for (const room of socket.rooms) {
                    if (room !== socket.id) {
                        socket.leave(room);
                    }
                }

                socket.join(form.id);
                console.log(`${user.username} (ID: ${user.id}) joined form room: ${form.id}`);

                // Fetch the current response for the form (this will create it if not exists)
                const currentResponse = await FormResponse.getByFormIdAndUserId(form.id, user.id); // Use getByFormIdAndUserId here
                console.log(`[SocketHandler] Fetched/Created response for form_joined:`, currentResponse); // NEW LOG

                socket.emit('form_joined', {
                    form: form,
                    response: currentResponse ? currentResponse.data : {}
                });

            } catch (error) {
                console.error(`Error joining form (${shareCode}):`, error.message);
                socket.emit('form_error', { message: 'Authentication failed or form not found. Please check your token or share code.' });
            }
        });

        /**
         * Event: 'update_field'
         * Updates a specific field in the form response in the database.
         * Broadcasts the update to all clients in the same form room.
         * Payload: { formId: string, fieldName: string, newValue: any }
         */
        socket.on('update_field', async ({ formId, fieldName, newValue }) => {
            if (!socket.user || !socket.rooms.has(formId)) {
                socket.emit('form_error', { message: 'Unauthorized or not joined to this form.' });
                return;
            }

            try {
                const userId = socket.user.id;
                const username = socket.user.username;

                // Update the field in the database using the user's specific response
                const updatedData = await FormResponse.updateField(
                    formId,
                    userId, // Pass userId to updateField
                    fieldName,
                    newValue,
                    username
                );

                socket.to(formId).emit('field_updated', {
                    formId: formId,
                    fieldName: fieldName,
                    newValue: newValue,
                    updatedBy: username
                });

                console.log(`User ${username} updated field ${fieldName} in form ${formId}`);

            } catch (error) {
                console.error(`Error updating field ${fieldName} for form ${formId}:`, error);
                socket.emit('form_error', { message: `Failed to update field: ${fieldName}.` });
            }
        });

        // Disconnection event
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });

        // Generic error handling for socket
        socket.on('error', (err) => {
            console.error('Socket error:', err);
            socket.emit('form_error', { message: 'An unexpected socket error occurred.' });
        });
    });
}

function getIo() {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call init() first.');
    }
    return io;
}

module.exports = {
    init,
    getIo
};

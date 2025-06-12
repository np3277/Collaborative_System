// src/app.js
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const formRoutes = require('./routes/formRoutes');
const path = require('path');

const app = express();

// Middleware
app.use(cors()); // Enable CORS for all origins (for development)
app.use(express.json()); // Parse JSON request bodies

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/auth', authRoutes); // Authentication routes
app.use('/api/forms', formRoutes); // <--- CHANGED THIS LINE: Form management routes are now specifically under /api/forms

// Basic route to check if the server is running
app.get('/', (req, res) => {
    // For the basic demo, we'll serve the index.html from static middleware.
    // This route can be used for API health check or other purposes.
    res.send('Collaborative Form System Backend is running.');
});

// Error handling middleware (basic example)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = app;

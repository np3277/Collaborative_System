// src/app.js
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const formRoutes = require('./routes/formRoutes');
const path = require('path');
const app = express();
app.use(cors()); 
app.use(express.json()); 
app.use(express.static(path.join(__dirname, '../public')));
app.use('/auth', authRoutes);
app.use('/api/forms', formRoutes); 
app.get('/', (req, res) => {
    // For the basic demo, we'll serve the index.html from static middleware.
    // This route can be used for API health check or other purposes.
    res.send('Collaborative Form System Backend is running.');
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = app;

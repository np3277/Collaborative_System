// src/routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth'); // Import JWT secret

const router = express.Router();

/**
 * @route POST /auth/register
 * @description Registers a new user.
 * @access Public
 */
router.post('/register', async (req, res) => {
    const { username, password, role } = req.body; // role can be 'admin' or 'user'

    if (!username || !password || !role) {
        return res.status(400).json({ message: 'Username, password, and role are required.' });
    }

    if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified. Must be "admin" or "user".' });
    }

    try {
        // Check if user already exists
        const existingUser = await db.oneOrNone('SELECT id FROM users WHERE username = $1', [username]);
        if (existingUser) {
            return res.status(409).json({ message: 'User with this username already exists.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Insert new user
        const newUser = await db.one(`
            INSERT INTO users (username, password_hash, role)
            VALUES ($1, $2, $3)
            RETURNING id, username, role
        `, [username, passwordHash, role]);

        res.status(201).json({
            message: 'User registered successfully.',
            user: { id: newUser.id, username: newUser.username, role: newUser.role }
        });
    } catch (error) {
        console.error('Error during user registration:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

/**
 * @route POST /auth/login
 * @description Authenticates a user and returns a JWT token.
 * @access Public
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        // Find user by username
        const user = await db.oneOrNone('SELECT id, username, password_hash, role FROM users WHERE username = $1', [username]);
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        console.error('Error during user login:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

module.exports = router;
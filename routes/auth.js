const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// User registration
router.post('/register', async (req, res) => {
    const { username, password, isAdmin } = req.body;

    try {
        // Ellenőrizzük, hogy létezik-e már ilyen felhasználó
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Jelszó hashelése
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Új felhasználó mentése az adatbázisba
        const newUser = await pool.query(
            'INSERT INTO users (username, password, is_admin) VALUES ($1, $2, $3) RETURNING id, username, is_admin',
            [username, hashedPassword, isAdmin || false] // Alapból nem admin
        );

        // JWT token generálása a frissen regisztrált felhasználónak
        const payload = {
            id: newUser.rows[0].id,
            username: newUser.rows[0].username,
            isAdmin: newUser.rows[0].is_admin
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30000d' });

        res.status(201).json({ token });

    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// User login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (user.rows.length > 0 && await bcrypt.compare(password, user.rows[0].password)) {
            const payload = {
                id: user.rows[0].id,
                username: user.rows[0].username,
                isAdmin: user.rows[0].is_admin
            };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30000d' }); // 1 órás token
            res.json({ token }); // Token visszaküldése a frontendnek
        } else {
            res.status(401).send('Invalid credentials');
        }
    } catch (err) {
        res.status(500).send('Error logging in');
    }
});


module.exports = router;

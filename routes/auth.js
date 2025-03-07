const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// User registration
router.post('/register', async (req, res) => {
    console.log(req.body)
    const { username, password, isAdmin } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        console.log("minden ok")
        await pool.query('INSERT INTO users (username, password, is_admin) VALUES ($1, $2, $3)', [username, hashedPassword, isAdmin || false]);
        console.log("minden ok")
        res.status(201).send('User created');
    } catch (err) {
        res.status(500).send('Error registering user');
    }
});

// User login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(req.body)
    try {
        console.log("minden ok")
        const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        console.log("minden ok")
        if (user.rows.length > 0 && await bcrypt.compare(password, user.rows[0].password)) {
            console.log("minden ok")
            req.session.user = { id: user.rows[0].id, isAdmin: user.rows[0].is_admin };
            res.send('Login successful');
        } else {
            res.status(401).send('Invalid credentials');
        }
    } catch (err) {
        res.status(500).send('Error logging in');
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.send('Logged out');
});

module.exports = router;

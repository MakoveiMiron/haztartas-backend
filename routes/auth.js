const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
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
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }); // 1 órás token
            res.json({ token }); // Token visszaküldése a frontendnek
        } else {
            res.status(401).send('Invalid credentials');
        }
    } catch (err) {
        res.status(500).send('Error logging in');
    }
});

module.exports = router;

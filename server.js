const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Middleware-ek
app.use(cors({
    origin: 'https://makoveimiron.github.io',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.use(express.json());

// JWT authentikáció middleware
function authenticateJWT(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).send('Access Denied');

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).send('Invalid Token');
        req.user = user;
        next();
    });
}

// API útvonalak
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', authenticateJWT, require('./routes/tasks'));

// Egyszerű ellenőrző végpont
app.get('/', (req, res) => {
    res.send('Háztartás Todo API működik 🚀');
});

// Port beállítása és indítása
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

module.exports = app;

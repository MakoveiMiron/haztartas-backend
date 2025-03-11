const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cron = require('node-cron'); // Import node-cron
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

// **Scheduled Task Reset - Runs Every Sunday at 23:00**
cron.schedule('0 23 * * 0', async () => {
    console.log("⏳ Resetting all task progress for a new week...");
    try {
        await pool.query('UPDATE task_progress SET is_completed = false');
        console.log("✅ All task progress reset successfully!");
    } catch (err) {
        console.error("❌ Error resetting task progress:", err);
    }
}, {
    scheduled: true,
    timezone: "Europe/Budapest" // Adjust to your timezone
});

// Port beállítása és indítása
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

module.exports = app;

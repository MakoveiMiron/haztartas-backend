const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const socketIo = require('socket.io');
const http = require('http');
dotenv.config();

const app = express();
app.use(express.json());

// PostgreSQL adatbázis kapcsolat
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.connect()
    .then(() => console.log('PostgreSQL adatbázis csatlakoztatva'))
    .catch(err => console.error('Adatbázis hiba:', err));

// WebSocket inicializálása
const server = http.createServer(app);
const io = socketIo(server);

// Middleware a JWT token ellenőrzésére
const authenticateToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'Nincs token, elutasítva' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Érvénytelen token' });
        req.user = user;
        next();
    });
};

// Egyszerű teszt endpoint
app.get('/', (req, res) => {
    res.send('Backend fut!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Szerver fut a ${PORT} porton`));
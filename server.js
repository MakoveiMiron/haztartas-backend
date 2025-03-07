const express = require('express');
const cors = require('cors'); 
const session = require('express-session');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }  // Railway PostgreSQL SSL beállítás
});

app.use(cors({
    origin: 'https://makoveimiron.github.io',  // A frontend domain, amelyről a kéréseket engedélyezzük
    methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Az engedélyezett HTTP metódusok
    credentials: true  // Ha session cookie-kat használsz, engedélyezd a hitelesítést
}));

// Middleware-ek
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' } // HTTPS csak production módban
}));

// API útvonalak
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));

// Egyszerű ellenőrző végpont
app.get('/', (req, res) => {
    res.send('Háztartás Todo API működik 🚀');
});

// Port beállítása és indítása
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

module.exports = app;

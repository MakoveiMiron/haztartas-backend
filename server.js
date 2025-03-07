const express = require('express');
const session = require('express-session');
const pg = require('pg');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const pool = new Pool({connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false  // This is required by Railway to establish an SSL connection.
    } });

app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true } // Change to true if using HTTPS
}));

// Routes (authentication, task management, etc.)
app.use('/auth', require('./routes/auth'));
app.use('/tasks', require('./routes/tasks'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Export app for testing
module.exports = app;

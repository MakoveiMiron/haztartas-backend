const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Get user tasks
router.get('/', async (req, res) => {
    if (!req.session.user) return res.status(403).send('Not authorized');
    const userId = req.session.user.id;
    try {
        const tasks = req.session.user.isAdmin ?
            await pool.query('SELECT * FROM tasks') :
            await pool.query('SELECT * FROM tasks WHERE user_id = $1', [userId]);
        res.json(tasks.rows);
    } catch (err) {
        res.status(500).send('Error fetching tasks');
    }
});

// Create task (admin only)
router.post('/', async (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) return res.status(403).send('Not authorized');
    const { name, description, frequency, assignedUsers } = req.body;
    try {
        const task = await pool.query('INSERT INTO tasks (name, description, frequency) VALUES ($1, $2, $3) RETURNING id', [name, description, frequency]);
        for (let userId of assignedUsers) {
            await pool.query('INSERT INTO user_tasks (user_id, task_id) VALUES ($1, $2)', [userId, task.rows[0].id]);
        }
        res.status(201).send('Task created');
    } catch (err) {
        res.status(500).send('Error creating task');
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.Postgres.DATABASE_URL });

// Get user tasks (admin can see all, regular users see only theirs)
router.get('/', async (req, res) => {
    if (!req.session.user) return res.status(403).send('Not authorized');
    const userId = req.session.user.id;

    try {
        // Admin can see all tasks, regular users can only see their tasks
        const tasks = req.session.user.isAdmin ?
            await pool.query('SELECT * FROM tasks') :
            await pool.query('SELECT * FROM tasks t JOIN user_tasks ut ON t.id = ut.task_id WHERE ut.user_id = $1', [userId]);
        
        res.json(tasks.rows);
    } catch (err) {
        res.status(500).send('Error fetching tasks');
    }
});

// Mark task as complete (user or admin)
router.put('/complete/:taskId', async (req, res) => {
    if (!req.session.user) return res.status(403).send('Not authorized');
    const userId = req.session.user.id;
    const taskId = req.params.taskId;

    try {
        // Check if the user is assigned to the task
        const taskAssignment = await pool.query('SELECT * FROM user_tasks WHERE user_id = $1 AND task_id = $2', [userId, taskId]);

        if (taskAssignment.rows.length === 0) return res.status(400).send('Task not assigned to user');

        // Update the task completion status
        await pool.query('UPDATE user_tasks SET completed = TRUE WHERE user_id = $1 AND task_id = $2', [userId, taskId]);

        // Check if any other user is assigned to the task
        const otherUserAssignments = await pool.query('SELECT * FROM user_tasks WHERE task_id = $1 AND completed = FALSE', [taskId]);

        // If all users have completed the task, mark the task as fully completed
        if (otherUserAssignments.rows.length === 0) {
            await pool.query('UPDATE tasks SET completed = TRUE WHERE id = $1', [taskId]);
        }

        res.status(200).send('Task marked as complete');
    } catch (err) {
        res.status(500).send('Error completing task');
    }
});

// Create task (admin only)
router.post('/', async (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) return res.status(403).send('Not authorized');
    const { name, description, frequency, assignedUsers, days } = req.body;
    
    try {
        const task = await pool.query('INSERT INTO tasks (name, description, frequency) VALUES ($1, $2, $3) RETURNING id', [name, description, frequency]);

        for (let userId of assignedUsers) {
            await pool.query('INSERT INTO user_tasks (user_id, task_id, days) VALUES ($1, $2, $3)', [userId, task.rows[0].id, days]);
        }

        res.status(201).send('Task created');
    } catch (err) {
        res.status(500).send('Error creating task');
    }
});

// Admin: Get all users' progress
router.get('/admin/progress', async (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) return res.status(403).send('Not authorized');

    try {
        const usersProgress = await pool.query(`
            SELECT u.id, u.name, t.name AS task_name, ut.completed, ut.days
            FROM users u
            JOIN user_tasks ut ON u.id = ut.user_id
            JOIN tasks t ON t.id = ut.task_id
            ORDER BY u.id, t.name
        `);

        res.json(usersProgress.rows);
    } catch (err) {
        res.status(500).send('Error fetching user progress');
    }
});

// Admin: Get tasks due after 8 PM today (for reminder purposes)
router.get('/admin/reminder', async (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) return res.status(403).send('Not authorized');
    
    const currentDate = new Date();
    currentDate.setHours(20, 0, 0, 0);  // 8 PM today
    
    try {
        const incompleteTasks = await pool.query(`
            SELECT u.name AS user_name, t.name AS task_name
            FROM user_tasks ut
            JOIN users u ON ut.user_id = u.id
            JOIN tasks t ON ut.task_id = t.id
            WHERE ut.completed = FALSE AND ut.days @> $1 AND CURRENT_DATE = ut.due_date
        `, [currentDate]);

        res.json(incompleteTasks.rows);
    } catch (err) {
        res.status(500).send('Error fetching reminders');
    }
});

// Admin: Get tasks for the current week
router.get('/admin/week', async (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) return res.status(403).send('Not authorized');
    
    try {
        const currentWeek = await pool.query(`
            SELECT * FROM tasks
            WHERE frequency = 'weekly' AND CURRENT_DATE BETWEEN start_date AND end_date
        `);

        res.json(currentWeek.rows);
    } catch (err) {
        res.status(500).send('Error fetching current week tasks');
    }
});

// Admin: Reset tasks for the new week
router.post('/admin/reset-week', async (req, res) => {
    if (!req.session.user || !req.session.user.isAdmin) return res.status(403).send('Not authorized');
    
    const currentWeekStart = new Date();
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay()); // Set to Sunday midnight

    try {
        await pool.query(`
            UPDATE user_tasks SET completed = FALSE
            WHERE due_date >= $1 AND due_date < $2
        `, [currentWeekStart, new Date()]);

        res.status(200).send('Week reset completed');
    } catch (err) {
        res.status(500).send('Error resetting week');
    }
});

module.exports = router;

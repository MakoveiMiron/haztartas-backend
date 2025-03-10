const express = require('express');
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
const router = express.Router();

// API route for fetching all tasks
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks');
    const tasks = result.rows;

    // Fetching assigned users for each task
    const tasksWithUsers = await Promise.all(
      tasks.map(async (task) => {
        const usersResult = await pool.query(
          'SELECT u.username FROM users u INNER JOIN user_tasks ut ON u.id = ut.user_id WHERE ut.task_id = $1',
          [task.id]
        );
        task.assignedUsers = usersResult.rows.map(user => user.username);
        return task;
      })
    );

    res.status(200).json(tasksWithUsers);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching tasks');
  }
});

// API route for fetching a single task by ID
router.get('/:taskId', async (req, res) => {
  const taskId = req.params.taskId;

  try {
    const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const task = taskResult.rows[0];

    if (!task) {
      return res.status(404).send('Task not found');
    }

    // Fetching assigned users for the task
    const usersResult = await pool.query(
      'SELECT u.username FROM users u INNER JOIN user_tasks ut ON u.id = ut.user_id WHERE ut.task_id = $1',
      [taskId]
    );
    task.assignedUsers = usersResult.rows.map(user => user.username);

    // Fetching task progress for each day
    const progressResult = await pool.query(
      'SELECT * FROM task_progress WHERE task_id = $1',
      [taskId]
    );

    task.progress = progressResult.rows;

    res.status(200).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching task');
  }
});

module.exports = router;

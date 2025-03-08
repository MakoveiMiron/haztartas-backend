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

    res.status(200).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching task');
  }
});

// API route for creating a task
router.post('/', async (req, res) => {
  const { name, description, assignedUsers, days } = req.body;

  try {
    // Insert new task into tasks table
    const result = await pool.query(
      'INSERT INTO tasks (name, description, days) VALUES ($1, $2, $3) RETURNING id',
      [name, description, days]
    );
    const taskId = result.rows[0].id;

    // Assign users to the task
    assignedUsers.forEach(async (userId) => {
      await pool.query(
        'INSERT INTO user_tasks (user_id, task_id) VALUES ($1, $2)',
        [userId, taskId]
      );
    });

    res.status(201).send('Task created');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating task');
  }
});

// API route for deleting a task
router.delete('/:taskId', async (req, res) => {
  const taskId = req.params.taskId;

  try {
    // Delete task from user_tasks (which assigns users to tasks)
    await pool.query('DELETE FROM user_tasks WHERE task_id = $1', [taskId]);

    // Delete the task itself
    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);

    res.status(200).send('Task deleted');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting task');
  }
});

// API route for fetching tasks assigned to a specific user
router.get('/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
      const result = await pool.query(
          `SELECT t.id, t.name, t.description, t.days
          FROM tasks t
          JOIN user_tasks ut ON t.id = ut.task_id
          WHERE ut.user_id = $1`,
          [userId]
      );
      res.status(200).json(result.rows);
  } catch (err) {
      console.error(err);
      res.status(500).send('Error fetching user tasks');
  }
});

// API route for fetching all users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    const users = result.rows;

    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching users');
  }
});

// API route for updating a task
router.put('/:taskId', async (req, res) => {
  const { name, description, assignedUsers, days } = req.body;
  const taskId = req.params.taskId;

  try {
    // Update the task
    await pool.query(
      'UPDATE tasks SET name = $1, description = $2, days = $3 WHERE id = $4',
      [name, description, days, taskId]
    );

    // Update user-task assignments
    // First, delete old assignments
    await pool.query('DELETE FROM user_tasks WHERE task_id = $1', [taskId]);

    // Add new assignments
    assignedUsers.forEach(async (userId) => {
      await pool.query(
        'INSERT INTO user_tasks (user_id, task_id) VALUES ($1, $2)',
        [userId, taskId]
      );
    });

    res.status(200).send('Task updated');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating task');
  }
});

module.exports = router;

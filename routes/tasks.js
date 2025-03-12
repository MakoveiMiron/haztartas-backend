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

// API route for creating a task
router.post('/', async (req, res) => {
  const { name, assignedUsers, days } = req.body;

  try {
    // Insert new task into tasks table
    const result = await pool.query(
      'INSERT INTO tasks (name, days) VALUES ($1, $2) RETURNING id',
      [name, days]
    );
    const taskId = result.rows[0].id;

    // Assign users to the task
    assignedUsers.forEach(async (userId) => {
      await pool.query(
        'INSERT INTO user_tasks (user_id, task_id) VALUES ($1, $2)',
        [userId, taskId]
      );
    });

    // Insert task progress for each day
    days.forEach(async (day) => {
      await pool.query(
        'INSERT INTO task_progress (task_id, day, is_completed) VALUES ($1, $2, $3)',
        [taskId, day, false]  // By default, the task is not completed
      );
    });

    res.status(201).send('Task created');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating task');
  }
});

// API route for deleting a task
router.delete('/delete/:taskId', async (req, res) => {
  const taskId = req.params.taskId;

  try {
    // Delete task progress first
    await pool.query('DELETE FROM task_progress WHERE task_id = $1', [taskId]);

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

// API route for fetching tasks assigned to a specific user, including task progress
router.get('/get/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    // Fetch tasks with their progress
    const result = await pool.query(
      `SELECT t.id, t.name, t.days, t.is_completed,
              tp.day, tp.is_completed as day_completed
       FROM tasks t
       JOIN user_tasks ut ON t.id = ut.task_id
       LEFT JOIN task_progress tp ON t.id = tp.task_id
       WHERE ut.user_id = $1`,
      [userId]
    );

    // Group tasks and their progress by task id
    const tasks = result.rows.reduce((acc, row) => {
      const taskId = row.id;
      
      if (!acc[taskId]) {
        acc[taskId] = {
          id: taskId,
          name: row.name,
          days: row.days,
          is_completed: row.is_completed,
          progress: {} // Initialize an empty progress object
        };
      }

      // Store the progress for each day
      acc[taskId].progress[row.day] = row.day_completed;

      return acc;
    }, {});

    // Return the tasks along with their progress
    res.status(200).json(Object.values(tasks));
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching user tasks');
  }
});

// API route for fetching all users
router.get('/fetch/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    const users = result.rows;

    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching users');
  }
});

// API route for updating the 'is_completed' status of a specific day in task progress
router.put('/day-progress/:taskId/:day', async (req, res) => {
  const { taskId, day } = req.params;

  try {
    // Update the task progress for the given taskId and day
    const result = await pool.query(
      'UPDATE task_progress SET is_completed = $1 WHERE task_id = $2 AND day = $3 RETURNING *',
      [true, taskId, day]
    );

    if (result.rowCount === 0) {
      return res.status(404).send('Task progress not found for the given day');
    }

    res.status(200).send('Task progress updated successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating task progress');
  }
});


// API route for fetching tasks assigned to all users with progress
router.get('/progress/all-users', async (req, res) => {
  try {
    // Fetch all users
    const usersResult = await pool.query('SELECT id, username FROM users');
    const users = usersResult.rows;

    // Fetch all tasks with progress for each user
    const usersWithTasks = await Promise.all(users.map(async (user) => {
      const tasksResult = await pool.query(
        `SELECT t.id, t.name, t.days,
                tp.day, tp.is_completed as day_completed
         FROM tasks t
         JOIN user_tasks ut ON t.id = ut.task_id
         LEFT JOIN task_progress tp ON t.id = tp.task_id
         WHERE ut.user_id = $1`,
        [user.id]
      );

      // Organizing tasks with their progress
      const tasks = tasksResult.rows.reduce((acc, row) => {
        const taskId = row.id;

        if (!acc[taskId]) {
          acc[taskId] = {
            id: taskId,
            name: row.name,
            days: row.days,
            progress: {} // Initialize an empty progress object
          };
        }

        // Store progress for each day
        acc[taskId].progress[row.day] = row.day_completed;

        return acc;
      }, {});

      return {
        userId: user.id,
        username: user.username,
        tasks: Object.values(tasks),
      };
    }));

    res.status(200).json(usersWithTasks);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching tasks for all users');
  }
});

// API route for updating a task
router.put('/update/:taskId', async (req, res) => {
  const { name, assignedUsers, days } = req.body;
  const taskId = req.params.taskId;
  console.log("assignedUsers",assignedUsers)
  try {
    // Update the task
    await pool.query(
      'UPDATE tasks SET name = $1, days = $2 WHERE id = $3',
      [name, days, taskId]
    );

    // Update user-task assignments
    // First, delete old assignments
    await pool.query('DELETE FROM user_tasks WHERE task_id = $1', [taskId]);

    // Add new assignments
    assignedUsers.forEach(async (userId) => {
      console.log("userId",userId)
      await pool.query(
        'INSERT INTO user_tasks (user_id, task_id) VALUES ($1, $2)',
        [userId, taskId]
      );
    });

    // Update task progress (for each day)
    days.forEach(async (day) => {
      await pool.query(
        'INSERT INTO task_progress (day, is_completed) VALUES ($1, $2) WHERE task_id = $3',
        [day, false, taskId]  // Initialize progress as false for each day
      );
    });

    res.status(200).send('Task updated');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating task');
  }
});

// API route for marking a task as completed
router.put('/complete/:taskId', async (req, res) => {
  const taskId = req.params.taskId;

  try {
    // Update the task status to completed
    const result = await pool.query(
      'UPDATE tasks SET is_completed = $1 WHERE id = $2',
      [true, taskId]
    );

    if (result.rowCount === 0) {
      return res.status(404).send('Task not found');
    }

    res.status(200).send('Task marked as completed');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error marking task as completed');
  }
});

module.exports = router;

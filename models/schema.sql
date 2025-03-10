-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE
);

-- Tasks Table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    days TEXT[], -- Array of days (e.g., 'Monday', 'Tuesday', etc.)
    is_completed BOOLEAN DEFAULT FALSE -- Tracks if the task is completed
);

-- Junction Table for User-Task Relationships (Many-to-Many)
CREATE TABLE user_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(user_id, task_id) -- Ensures a user is only assigned to a task once
);

-- Task Progress Table (Track Completion of Each Day for Each Task)
CREATE TABLE task_progress (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    day TEXT NOT NULL,  -- Store the day name (e.g., 'Monday', 'Tuesday', etc.)
    is_completed BOOLEAN DEFAULT FALSE, -- Track if the task is completed on that day
    UNIQUE(task_id, day) -- Prevents duplicate records for a task and a day
);

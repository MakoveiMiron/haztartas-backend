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
    description TEXT,
    days TEXT[] -- Array of days (e.g., 'Monday', 'Tuesday', etc.)
);

-- Junction Table for User-Task Relationships (Many-to-Many)
CREATE TABLE user_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(user_id, task_id) -- Ensures a user is only assigned to a task once
);

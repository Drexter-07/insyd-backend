-- Step 1: Create the database
CREATE DATABASE insyd_db;
GO

-- Step 2: Switch to the context of our new database
USE insyd_db;
GO

-- Step 3: Create the Users table
CREATE TABLE Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    email NVARCHAR(255) NOT NULL UNIQUE,
    job_role NVARCHAR(100),
    specialization NVARCHAR(100),
    city NVARCHAR(100),
    company_name NVARCHAR(255), -- <-- ADDED THIS LINE
    profile_summary NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- RENAMED: from Posts to Articles
CREATE TABLE Articles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    author_id INT NOT NULL REFERENCES Users(id),
    title NVARCHAR(255) NOT NULL,
    content NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- ADDED: The new Jobs table
CREATE TABLE Jobs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    author_id INT NOT NULL REFERENCES Users(id), -- The recruiter/poster
    title NVARCHAR(255) NOT NULL,
    company_name NVARCHAR(255),
    location NVARCHAR(255),
    description NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Create the Comments table, now linked correctly to the Articles table
CREATE TABLE Comments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    article_id INT NOT NULL, -- Renamed for clarity
    author_id INT NOT NULL,
    content NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (article_id) REFERENCES Articles(id), -- Corrected table reference
    FOREIGN KEY (author_id) REFERENCES Users(id)
);
GO

-- ADDED: Create a flexible Likes table for posts, comments, etc.
CREATE TABLE Likes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    entity_id INT NOT NULL,
    entity_type NVARCHAR(50) NOT NULL, -- e.g., 'post' or 'comment'
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES Users(id),
    -- This ensures a user can only like a specific item once
    UNIQUE(user_id, entity_id, entity_type)
);
GO

-- Create the Follows table
CREATE TABLE Follows (
    follower_id INT NOT NULL,
    following_id INT NOT NULL,
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES Users(id),
    FOREIGN KEY (following_id) REFERENCES Users(id)
);
GO

-- Create the Notifications table
CREATE TABLE Notifications (
    id INT IDENTITY(1,1) PRIMARY KEY,
    recipient_id INT NOT NULL,
    actor_id INT NOT NULL,
    event_type NVARCHAR(50) NOT NULL,
    entity_id INT,
    entity_type NVARCHAR(50),
    content NVARCHAR(MAX),
    is_read BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (recipient_id) REFERENCES Users(id),
    FOREIGN KEY (actor_id) REFERENCES Users(id)
);
GO

-- Insert dummy users
INSERT INTO Users (name, email, job_role, specialization, city, company_name, profile_summary) VALUES
('Alice Johnson', 'alice@insyd.com', 'Principal Architect', 'Sustainable Design', 'Mumbai', 'Innovate Arch Inc.', 'An award-winning architect...'),
('Bob Williams', 'bob@insyd.com', 'Interior Designer', 'Residential Spaces', 'Delhi', 'DesignRight', 'Specializes in minimalist...'),
('Charlie Brown', 'charlie@insyd.com', 'Architecture Student', 'Urban Planning', 'Bangalore', NULL, 'A final-year student...'); -- Charlie is a student, so no company
GO
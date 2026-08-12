-- Create Databases
CREATE DATABASE IF NOT EXISTS user_db;
CREATE DATABASE IF NOT EXISTS ticket_db;
CREATE DATABASE IF NOT EXISTS comment_db;
CREATE DATABASE IF NOT EXISTS attachment_db;

-- Use User Database and seed initial data
USE user_db;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL -- CUSTOMER, AGENT
);

INSERT INTO users (username, email, password, role) VALUES 
('john_doe', 'john.doe@company.com', 'password', 'CUSTOMER'),
('agent_carter', 'agent.carter@support.com', 'password', 'AGENT');



-- arn:aws:secretsmanager:ap-south-1:076648863714:secret:tkt/db/credentials-coss6J - secrete arn
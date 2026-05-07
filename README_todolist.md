# Daily Routine & Workload Management System

> **Note:** This document includes legacy MySQL‑based planning notes. The current implementation uses **MongoDB + Mongoose** and the backend defaults to port **3010**. For the up‑to‑date setup, see `README.md` and `docs/SETUP.md`.

A web-based to-do list application focused on tracking daily routines, managing time effectively, and balancing workload for improved productivity.

## 📋 Project Overview

This system helps users manage their daily activities by providing time-based task management, workload visualization, and routine tracking. Unlike traditional to-do lists, this focuses on **when** tasks happen and **how much time** they require, helping users realistically plan their days.

## 🔍 Implementation Audit (April 2026)

This file contains both product vision and implementation goals. The current codebase status is:

### Implemented Now
- Auth flow (register/login/logout/me)
- Task CRUD APIs + status update + today/week/upcoming API endpoints
- Today view with task completion and add-task modal
- Tasks page with search/filter/delete/mark complete
- **Dashboard with user profile details, all tasks listing, and time/usage analysis**
  - Time analysis from task durations + schedule buckets
  - Most frequently used system parts derived from route usage tracking
- Settings page with profile readout and logout

### API Implemented but UI Pending
- Categories endpoints
- Routines endpoints
- Analytics endpoints

### UI Placeholder / Not Fully Implemented Yet
- Week View page
- Routines page
- Analytics page

Use this section as the source of truth for what is currently functional versus planned.

## 🎯 Project Goals

- Enable users to track and manage their daily routines effectively
- Help users understand their time allocation and workload capacity
- Provide insights into productivity patterns and time usage
- Reduce over-commitment by visualizing daily capacity
- Build sustainable habits through routine tracking

## 🚀 Key Features

### 1. Time-Based Task Management
- **Time Slots**: Assign specific times to tasks, not just dates
- **Duration Tracking**: Estimate and track how long tasks take
- **Time Blocking**: Visual calendar/timeline view of the day
- **Easy Rescheduling**: Drag-and-drop interface to move tasks
- **Recurring Tasks**: Set up daily, weekly, or custom recurring routines
- **Task Templates**: Save common task sequences as templates

### 2. Workload Visualization
- **Daily Capacity Dashboard**: View available hours vs. scheduled hours
- **Overload Alerts**: Visual warnings when daily schedule is too packed
- **Progress Tracking**: Real-time view of day completion
- **Time Analysis**: Compare estimated vs. actual time spent
- **Workload Balance**: Week/month view of workload distribution

### 3. Daily Routine Features
- **Routine Templates**: Pre-built morning, afternoon, evening routines
- **Habit Tracking**: Mark habits as complete and track streaks
- **Life Area Categories**: Organize tasks by work, personal, health, fitness, learning, etc.
- **Quick Daily Planning**: Fast interface for planning tomorrow or next week
- **Routine Library**: Save and reuse successful routines

### 4. Priority & Focus Management
- **Priority Levels**: Urgent/important matrix (Eisenhower Matrix)
- **Focus Mode**: Distraction-free view showing only current task
- **Daily Top Tasks**: Highlight 3-5 most important tasks for the day
- **Smart Scheduling**: Suggest optimal times based on priority and energy levels
- **Do Not Disturb Integration**: Block time for deep work

### 5. Analytics & Insights
- **Routine Adherence**: Track how well you stick to planned routines
- **Time Usage Breakdown**: Visual charts showing where time goes
- **Completion Rates**: Daily, weekly, monthly task completion statistics
- **Productivity Trends**: Identify peak productivity times and patterns
- **Weekly/Monthly Reports**: Summarized insights and achievements
- **Goal Tracking**: Monitor progress toward longer-term goals

### 6. User Experience
- **Quick Task Entry**: Add tasks with minimal clicks
- **Today View**: Default landing page showing today's schedule
- **Intuitive Rescheduling**: Simple drag-drop or swipe gestures
- **Mobile Responsive**: Fully functional on phones and tablets
- **Dark Mode**: Eye-friendly interface for different times of day
- **Keyboard Shortcuts**: Power user features for quick navigation

## 📊 User Stories

### As a User, I want to:
1. See my entire day at a glance with time slots
2. Quickly add a task with a specific time and duration
3. Get warned when I'm scheduling too much for one day
4. Track my morning and evening routines
5. See how much time I spend on different life areas
6. Reschedule tasks easily when plans change
7. Set recurring tasks that automatically appear
8. Focus on my current task without distractions
9. Review my productivity patterns over time
10. Plan my week ahead based on available time

## 🏗️ Technical Requirements

### Functional Requirements
- User authentication and authorization
- Create, read, update, delete (CRUD) operations for tasks
- Time-based scheduling and calendar integration
- Real-time workload calculation
- Data persistence and cloud sync
- Search and filter functionality
- Notification system for reminders
- Data export (CSV, PDF reports)

### Non-Functional Requirements
- **Performance**: Page load < 2 seconds, smooth interactions
- **Scalability**: Support for thousands of tasks per user
- **Accessibility**: WCAG 2.1 AA compliance
- **Security**: Encrypted data storage, secure authentication
- **Reliability**: 99.9% uptime, automatic backups
- **Usability**: Intuitive interface requiring minimal learning
- **Compatibility**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Mobile**: Responsive design for all screen sizes

## 🛠️ Technology Stack

### Frontend
- **Core**: HTML5, CSS3, JavaScript (ES6+)
- **Framework**: React.js 18+
- **State Management**: React Context API + useReducer or Redux Toolkit
- **Styling**: CSS Modules or Styled Components with custom CSS
- **UI Components**: Custom components with Tailwind CSS or Bootstrap
- **Calendar/Timeline**: FullCalendar.js or React-Calendar
- **Charts**: Chart.js with react-chartjs-2 for analytics
- **Date/Time**: date-fns or Moment.js
- **HTTP Client**: Axios
- **Routing**: React Router DOM

### Backend
- **Runtime**: Node.js (v18+ LTS)
- **Framework**: Express.js
- **Database**: MySQL 8.0+
- **ORM/Query Builder**: Sequelize or raw MySQL2 driver
- **Authentication**: JWT (jsonwebtoken) with bcrypt for password hashing
- **Validation**: express-validator or Joi
- **API Architecture**: RESTful API
- **Environment Variables**: dotenv
- **Logging**: Winston or Morgan
- **CORS**: cors middleware

### Database
- **Primary Database**: MySQL 8.0+
- **Database Design**: Normalized relational schema
- **Connection Pooling**: MySQL2 connection pool
- **Migrations**: Sequelize migrations or custom SQL scripts
- **Backup Strategy**: Automated daily backups

### Development Tools
- **Package Manager**: npm or yarn
- **Code Formatting**: Prettier
- **Linting**: ESLint
- **Version Control**: Git & GitHub
- **API Testing**: Postman or Thunder Client

### Deployment
- **Frontend Hosting**: Vercel, Netlify, or AWS S3 + CloudFront
- **Backend Hosting**: Heroku, DigitalOcean, AWS EC2, or Railway
- **Database Hosting**: AWS RDS, DigitalOcean Managed MySQL, or PlanetScale
- **CI/CD**: GitHub Actions
- **SSL/HTTPS**: Let's Encrypt or cloud provider SSL

## 📁 Database Schema (MySQL)

### Users Table
```sql
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Tasks Table
```sql
CREATE TABLE tasks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    scheduled_date DATE,
    scheduled_time TIME,
    duration_minutes INT,
    actual_duration_minutes INT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern JSON,
    parent_task_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    INDEX idx_user_date (user_id, scheduled_date),
    INDEX idx_status (status),
    INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Categories Table
```sql
CREATE TABLE categories (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_category (user_id, name),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Routines Table
```sql
CREATE TABLE routines (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    routine_type ENUM('morning', 'afternoon', 'evening', 'custom') DEFAULT 'custom',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_active (user_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Routine_Tasks Table
```sql
CREATE TABLE routine_tasks (
    id VARCHAR(36) PRIMARY KEY,
    routine_id VARCHAR(36) NOT NULL,
    task_template JSON NOT NULL,
    task_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
    INDEX idx_routine_order (routine_id, task_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Analytics Table
```sql
CREATE TABLE analytics (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    total_tasks_scheduled INT DEFAULT 0,
    total_tasks_completed INT DEFAULT 0,
    total_time_scheduled_minutes INT DEFAULT 0,
    total_time_spent_minutes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_date (user_id, date),
    INDEX idx_user_date (user_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 📂 Project Structure

```
daily-routine-tracker/
│
├── frontend/                      # React Frontend Application
│   ├── public/
│   │   ├── index.html
│   │   ├── favicon.ico
│   │   └── manifest.json
│   │
│   ├── src/
│   │   ├── assets/               # Images, fonts, static files
│   │   │   ├── images/
│   │   │   └── styles/
│   │   │       └── global.css
│   │   │
│   │   ├── components/           # Reusable React components
│   │   │   ├── common/
│   │   │   │   ├── Button.jsx
│   │   │   │   ├── Input.jsx
│   │   │   │   ├── Modal.jsx
│   │   │   │   └── Loader.jsx
│   │   │   │
│   │   │   ├── tasks/
│   │   │   │   ├── TaskItem.jsx
│   │   │   │   ├── TaskList.jsx
│   │   │   │   ├── TaskForm.jsx
│   │   │   │   └── TaskCalendar.jsx
│   │   │   │
│   │   │   ├── routines/
│   │   │   │   ├── RoutineCard.jsx
│   │   │   │   └── RoutineBuilder.jsx
│   │   │   │
│   │   │   └── analytics/
│   │   │       ├── Chart.jsx
│   │   │       └── StatsCard.jsx
│   │   │
│   │   ├── pages/                # Page components (routes)
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── TodayView.jsx
│   │   │   ├── WeekView.jsx
│   │   │   ├── Tasks.jsx
│   │   │   ├── Routines.jsx
│   │   │   ├── Analytics.jsx
│   │   │   └── Settings.jsx
│   │   │
│   │   ├── context/              # React Context for state management
│   │   │   ├── AuthContext.jsx
│   │   │   ├── TaskContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   │
│   │   ├── hooks/                # Custom React hooks
│   │   │   ├── useAuth.js
│   │   │   ├── useTasks.js
│   │   │   └── useAnalytics.js
│   │   │
│   │   ├── services/             # API calls and external services
│   │   │   ├── api.js            # Axios instance configuration
│   │   │   ├── authService.js
│   │   │   ├── taskService.js
│   │   │   ├── routineService.js
│   │   │   └── analyticsService.js
│   │   │
│   │   ├── utils/                # Utility functions
│   │   │   ├── dateHelpers.js
│   │   │   ├── validators.js
│   │   │   └── constants.js
│   │   │
│   │   ├── App.jsx               # Main App component
│   │   ├── App.css               # App-level styles
│   │   └── index.js              # Entry point
│   │
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── backend/                       # Node.js + Express Backend
│   ├── src/
│   │   ├── config/               # Configuration files
│   │   │   ├── database.js       # MySQL connection
│   │   │   ├── jwt.js            # JWT configuration
│   │   │   └── env.js            # Environment variables
│   │   │
│   │   ├── models/               # Database models (Sequelize or raw)
│   │   │   ├── User.js
│   │   │   ├── Task.js
│   │   │   ├── Category.js
│   │   │   ├── Routine.js
│   │   │   ├── RoutineTask.js
│   │   │   └── Analytics.js
│   │   │
│   │   ├── controllers/          # Route controllers
│   │   │   ├── authController.js
│   │   │   ├── taskController.js
│   │   │   ├── categoryController.js
│   │   │   ├── routineController.js
│   │   │   └── analyticsController.js
│   │   │
│   │   ├── routes/               # API routes
│   │   │   ├── authRoutes.js
│   │   │   ├── taskRoutes.js
│   │   │   ├── categoryRoutes.js
│   │   │   ├── routineRoutes.js
│   │   │   └── analyticsRoutes.js
│   │   │
│   │   ├── middleware/           # Custom middleware
│   │   │   ├── authMiddleware.js # JWT verification
│   │   │   ├── errorHandler.js   # Error handling
│   │   │   ├── validator.js      # Input validation
│   │   │   └── rateLimiter.js    # Rate limiting
│   │   │
│   │   ├── services/             # Business logic
│   │   │   ├── taskService.js
│   │   │   ├── routineService.js
│   │   │   └── analyticsService.js
│   │   │
│   │   ├── utils/                # Utility functions
│   │   │   ├── logger.js
│   │   │   ├── responseHandler.js
│   │   │   └── helpers.js
│   │   │
│   │   ├── app.js                # Express app setup
│   │   └── server.js             # Server entry point
│   │
│   ├── migrations/               # Database migrations
│   │   ├── 001_create_users_table.sql
│   │   ├── 002_create_tasks_table.sql
│   │   └── ...
│   │
│   ├── seeders/                  # Database seeders (test data)
│   │   └── demo_data.sql
│   │
│   ├── tests/                    # Backend tests
│   │   ├── unit/
│   │   └── integration/
│   │
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── database/                      # Database scripts
│   ├── schema.sql                # Complete database schema
│   ├── seed.sql                  # Initial data
│   └── migrations/
│
├── docs/                          # Documentation
│   ├── API.md                    # API documentation
│   ├── SETUP.md                  # Setup instructions
│   └── DEPLOYMENT.md             # Deployment guide
│
├── .gitignore
├── LICENSE
└── README.md                      # Main project README
```

### Users Table
```sql
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Tasks Table
```sql
CREATE TABLE tasks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    scheduled_date DATE,
    scheduled_time TIME,
    duration_minutes INT,
    actual_duration_minutes INT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern JSON,
    parent_task_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    INDEX idx_user_date (user_id, scheduled_date),
    INDEX idx_status (status),
    INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Categories Table
```sql
CREATE TABLE categories (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_category (user_id, name),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Routines Table
```sql
CREATE TABLE routines (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    routine_type ENUM('morning', 'afternoon', 'evening', 'custom') DEFAULT 'custom',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_active (user_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Routine_Tasks Table
```sql
CREATE TABLE routine_tasks (
    id VARCHAR(36) PRIMARY KEY,
    routine_id VARCHAR(36) NOT NULL,
    task_template JSON NOT NULL,
    task_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
    INDEX idx_routine_order (routine_id, task_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Analytics Table
```sql
CREATE TABLE analytics (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    total_tasks_scheduled INT DEFAULT 0,
    total_tasks_completed INT DEFAULT 0,
    total_time_scheduled_minutes INT DEFAULT 0,
    total_time_spent_minutes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_date (user_id, date),
    INDEX idx_user_date (user_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 🎨 User Interface Sections

### 1. Today View (Main Dashboard)
- Current time indicator
- Timeline/calendar view of today's tasks
- Workload meter (capacity indicator)
- Quick add task button
- Current task focus card
- Completion progress bar

### 2. Week View
- 7-day calendar grid
- Workload distribution across days
- Drag-and-drop task rescheduling
- Weekly goals section

### 3. Task Management
- All tasks list with filters
- Search functionality
- Bulk operations
- Task details modal

### 4. Routines
- Routine library
- Create/edit routine interface
- Activate/deactivate routines
- Routine templates

### 5. Analytics Dashboard
- Time usage pie/bar charts
- Completion rate trends
- Productivity heatmap
- Category breakdown
- Weekly/monthly reports

### 6. Settings
- Profile management
- Preferences (timezone, work hours, theme)
- Notification settings
- Data export/import
- Account management

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/register          # Register new user
POST   /api/auth/login             # Login user
POST   /api/auth/logout            # Logout user
GET    /api/auth/me                # Get current user
PUT    /api/auth/update-profile    # Update user profile
PUT    /api/auth/change-password   # Change password
```

### Tasks
```
GET    /api/tasks                  # Get all tasks (with filters)
GET    /api/tasks/:id              # Get single task
POST   /api/tasks                  # Create new task
PUT    /api/tasks/:id              # Update task
DELETE /api/tasks/:id              # Delete task
PATCH  /api/tasks/:id/complete     # Mark task as complete
PATCH  /api/tasks/:id/status       # Update task status
GET    /api/tasks/today            # Get today's tasks
GET    /api/tasks/week             # Get this week's tasks
GET    /api/tasks/upcoming         # Get upcoming tasks
POST   /api/tasks/bulk-delete      # Delete multiple tasks
```

### Categories
```
GET    /api/categories             # Get all categories
GET    /api/categories/:id         # Get single category
POST   /api/categories             # Create category
PUT    /api/categories/:id         # Update category
DELETE /api/categories/:id         # Delete category
```

### Routines
```
GET    /api/routines               # Get all routines
GET    /api/routines/:id           # Get single routine
POST   /api/routines               # Create routine
PUT    /api/routines/:id           # Update routine
DELETE /api/routines/:id           # Delete routine
PATCH  /api/routines/:id/activate  # Activate/deactivate routine
POST   /api/routines/:id/apply     # Apply routine to create tasks
```

### Analytics
```
GET    /api/analytics/daily/:date  # Get daily analytics
GET    /api/analytics/weekly       # Get weekly analytics
GET    /api/analytics/monthly      # Get monthly analytics
GET    /api/analytics/summary      # Get overall summary
GET    /api/analytics/trends       # Get productivity trends
```

### Request/Response Examples

#### Create Task
**Request:**
```json
POST /api/tasks
{
  "title": "Morning Workout",
  "description": "30 minutes cardio and strength training",
  "category": "Health",
  "priority": "high",
  "scheduled_date": "2024-02-07",
  "scheduled_time": "06:00:00",
  "duration_minutes": 30,
  "is_recurring": true,
  "recurrence_pattern": {
    "frequency": "daily",
    "days": ["monday", "wednesday", "friday"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "id": "uuid-here",
    "title": "Morning Workout",
    "description": "30 minutes cardio and strength training",
    "category": "Health",
    "priority": "high",
    "status": "pending",
    "scheduled_date": "2024-02-07",
    "scheduled_time": "06:00:00",
    "duration_minutes": 30,
    "created_at": "2024-02-07T10:30:00Z"
  }
}
```

#### Get Today's Tasks
**Request:**
```json
GET /api/tasks/today
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "uuid-1",
        "title": "Morning Workout",
        "scheduled_time": "06:00:00",
        "duration_minutes": 30,
        "status": "completed"
      },
      {
        "id": "uuid-2",
        "title": "Team Meeting",
        "scheduled_time": "10:00:00",
        "duration_minutes": 60,
        "status": "pending"
      }
    ],
    "total_tasks": 8,
    "completed_tasks": 3,
    "total_scheduled_minutes": 420,
    "completion_percentage": 37.5
  }
}
```

## 🚀 Installation & Setup

### 1. Today View (Main Dashboard)
- Current time indicator
- Timeline/calendar view of today's tasks
- Workload meter (capacity indicator)
- Quick add task button
- Current task focus card
- Completion progress bar

### 2. Week View
- 7-day calendar grid
- Workload distribution across days
- Drag-and-drop task rescheduling
- Weekly goals section

### 3. Task Management
- All tasks list with filters
- Search functionality
- Bulk operations
- Task details modal

### 4. Routines
- Routine library
- Create/edit routine interface
- Activate/deactivate routines
- Routine templates

### 5. Analytics Dashboard
- Time usage pie/bar charts
- Completion rate trends
- Productivity heatmap
- Category breakdown
- Weekly/monthly reports

### 6. Settings
- Profile management
- Preferences (timezone, work hours, theme)
- Notification settings
- Data export/import
- Account management

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v18+ LTS)
- MySQL (v8.0+)
- npm or yarn
- Git

### Backend Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd daily-routine-tracker/backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` file:
```env
# Server Configuration
PORT=3010
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=routine_tracker
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=7d

# CORS
CORS_ORIGIN=http://localhost:3000
```

4. **Create MySQL Database**
```bash
mysql -u root -p
```
```sql
CREATE DATABASE routine_tracker;
USE routine_tracker;
```

5. **Run database migrations**
```bash
# If using migration files
npm run migrate

# Or run the schema.sql directly
mysql -u your_user -p routine_tracker < ../database/schema.sql
```

6. **Start the server**
```bash
# Development mode with nodemon
npm run dev

# Production mode
npm start
```

Server should be running on `http://localhost:3010`

### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd ../frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` file:
```env
REACT_APP_API_URL=http://localhost:3010/api
REACT_APP_API_TIMEOUT=10000
```

4. **Start the development server**
```bash
npm start
```

Frontend should be running on `http://localhost:3000`

### Quick Start (Development)

If you want to run both frontend and backend simultaneously:

1. Install `concurrently` in the root directory:
```bash
npm install -g concurrently
```

2. Add this script to root `package.json`:
```json
{
  "scripts": {
    "dev": "concurrently \"cd backend && npm run dev\" \"cd frontend && npm start\""
  }
}
```

3. Run both servers:
```bash
npm run dev
```

### Database Seeding (Optional)

To add demo data for testing:
```bash
cd backend
npm run seed
```

Or manually:
```bash
mysql -u your_user -p routine_tracker < ../database/seed.sql
```

## 📈 Development Roadmap

### Phase 1: MVP (Minimum Viable Product)
- [ ] User authentication (signup, login, logout)
- [ ] Basic CRUD operations for tasks
- [ ] Today view with task list
- [ ] Add task with time and duration
- [ ] Mark tasks as complete
- [ ] Simple workload calculation
- [ ] Basic mobile responsiveness

### Phase 2: Core Features
- [ ] Calendar/timeline view
- [ ] Drag-and-drop rescheduling
- [ ] Categories and priority levels
- [ ] Recurring tasks
- [ ] Week view
- [ ] Basic analytics (completion rates)
- [ ] Task search and filters

### Phase 3: Advanced Features
- [ ] Routine templates and management
- [ ] Focus mode
- [ ] Advanced analytics dashboard
- [ ] Notifications and reminders
- [ ] Data export
- [ ] Habit tracking
- [ ] Dark mode

### Phase 4: Optimization & Polish
- [ ] Performance optimization
- [ ] Enhanced mobile experience
- [ ] Accessibility improvements
- [ ] Advanced reporting
- [ ] User onboarding tutorial
- [ ] Keyboard shortcuts

## 🎯 Success Metrics

- **User Engagement**: Daily active users, average session duration
- **Task Completion**: Average daily completion rate > 70%
- **Retention**: 7-day and 30-day user retention rates
- **Performance**: Page load time < 2 seconds
- **User Satisfaction**: Net Promoter Score (NPS) > 50
- **System Reliability**: Uptime > 99.5%

## 🔒 Security Considerations

- Password hashing with bcrypt (minimum 10 rounds)
- JWT token expiration and refresh mechanism
- HTTPS encryption for all communications
- SQL injection prevention through parameterized queries
- XSS protection through input sanitization
- CSRF token implementation
- Rate limiting on API endpoints
- Regular security audits

## 🧪 Testing Strategy

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test API endpoints and database operations
- **E2E Tests**: Test complete user workflows (Cypress or Playwright)
- **Performance Tests**: Load testing and stress testing
- **Accessibility Tests**: Automated and manual accessibility checks
- **User Testing**: Beta testing with real users

## 📚 Future Enhancements

- AI-powered task scheduling suggestions
- Integration with calendar apps (Google Calendar, Outlook)
- Team/family sharing features
- Voice input for task creation
- Pomodoro timer integration
- Desktop app (Electron)
- Mobile native apps (iOS/Android)
- Smart notifications based on user patterns
- Gamification (achievements, streaks, levels)
- Integration with productivity tools (Trello, Notion, Slack)

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines before submitting pull requests.

## 📄 License

[Choose appropriate license - MIT, Apache 2.0, etc.]

## 👥 Team

[Add team member information]

## 📞 Contact

[Add contact information or support channels]

---

**Note**: This README will be updated as the project evolves. Last updated: [Date]

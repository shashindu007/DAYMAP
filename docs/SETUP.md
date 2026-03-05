# DayMap Setup Guide

Complete setup instructions for the Daily Routine & Workload Management System.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher)
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify: `node --version`

- **npm** (comes with Node.js)
  - Verify: `npm --version`

- **MySQL** (v8.0 or higher)
  - Option 1: Install XAMPP (includes MySQL, Apache, PHP)
  - Option 2: Install MySQL standalone
  - Verify MySQL is running

- **Git** (optional, for version control)
  - Download from [git-scm.com](https://git-scm.com/)

## Step-by-Step Setup

### 1. Project Location

The project should be in:
```
c:\xampp\htdocs\DayMap
```

### 2. Database Setup

#### Option A: Using XAMPP Control Panel

1. Start XAMPP Control Panel
2. Start MySQL service
3. Click "Admin" button for MySQL (opens phpMyAdmin)
4. Go to "SQL" tab
5. Copy and paste contents from `database/schema.sql`
6. Click "Go" to execute

#### Option B: Using MySQL Command Line

1. Open Command Prompt
2. Navigate to MySQL bin directory:
```bash
cd C:\xampp\mysql\bin
```

3. Login to MySQL:
```bash
mysql -u root -p
```

4. Create and setup database:
```bash
mysql -u root -p < c:\xampp\htdocs\DayMap\database\schema.sql
```

#### Verify Database

```sql
SHOW DATABASES;
USE routine_tracker;
SHOW TABLES;
```

You should see 6 tables:
- users
- tasks
- categories
- routines
- routine_tasks
- analytics

### 3. Backend Setup

1. Open Command Prompt
2. Navigate to backend directory:
```bash
cd c:\xampp\htdocs\DayMap\backend
```

3. Install dependencies:
```bash
npm install
```

This will install:
- express
- mysql2
- bcryptjs
- jsonwebtoken
- cors
- helmet
- express-validator
- express-rate-limit
- morgan
- dotenv
- uuid

4. Create environment file:
```bash
copy .env.example .env
```

5. Edit `.env` file with your settings:
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_NAME=routine_tracker
DB_USER=root
DB_PASSWORD=

JWT_SECRET=your_very_secure_random_string_change_this
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

CORS_ORIGIN=http://localhost:3000

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

BCRYPT_ROUNDS=10
```

**Important:** Change `JWT_SECRET` to a long random string!

6. Start backend server:
```bash
npm run dev
```

You should see:
```
✅ Database connected successfully

╔════════════════════════════════════════════════════════════╗
║   Daily Routine & Workload Management System - Backend    ║
╚════════════════════════════════════════════════════════════╝

🚀 Server running on port 5000
🌍 Environment: development
📡 API URL: http://localhost:5000
```

7. Test the API:
Open browser and go to: `http://localhost:5000`

You should see a JSON response with API information.

### 4. Frontend Setup

1. Open NEW Command Prompt window
2. Navigate to frontend directory:
```bash
cd c:\xampp\htdocs\DayMap\frontend
```

3. Install dependencies:
```bash
npm install
```

This will install:
- react
- react-dom
- react-router-dom
- axios
- chart.js
- react-chartjs-2
- date-fns
- react-calendar

4. Create environment file:
```bash
copy .env.example .env
```

5. Edit `.env` file:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_API_TIMEOUT=10000
```

6. Start frontend development server:
```bash
npm start
```

The app should automatically open in your browser at:
```
http://localhost:3000
```

### 5. Verify Installation

1. **Backend Health Check**
   - Navigate to: `http://localhost:5000/health`
   - Should return: `{"success": true, "message": "Server is running"}`

2. **Frontend Application**
   - Navigate to: `http://localhost:3000`
   - Should see the Login page

3. **Create Test Account**
   - Click "Register here"
   - Fill in registration form:
     - Name: Test User
     - Email: test@example.com
     - Password: Test1234
     - Confirm Password: Test1234
   - Click "Register"
   - Should redirect to Today's Tasks page

4. **Test Login**
   - Logout (Settings > Logout)
   - Login with test account
   - Should successfully login

## Common Issues & Solutions

### Issue: "Cannot connect to MySQL"

**Solution:**
1. Verify MySQL is running in XAMPP Control Panel
2. Check MySQL port (default: 3306)
3. Verify credentials in backend `.env` file
4. Test MySQL connection:
```bash
mysql -u root -p
```

### Issue: "Port 5000 already in use"

**Solution:**
1. Change PORT in backend `.env` to different port (e.g., 5001)
2. Update REACT_APP_API_URL in frontend `.env` accordingly
3. Restart servers

### Issue: "npm install" fails

**Solution:**
1. Delete `node_modules` folder
2. Delete `package-lock.json`
3. Run `npm cache clean --force`
4. Run `npm install` again

### Issue: "CORS error" in browser console

**Solution:**
1. Verify backend CORS_ORIGIN matches frontend URL
2. Make sure both servers are running
3. Clear browser cache
4. Try incognito/private mode

### Issue: "JWT token errors"

**Solution:**
1. Verify JWT_SECRET is set in backend `.env`
2. Logout and login again
3. Clear localStorage in browser dev tools
4. Check token expiration settings

## Production Deployment

### Backend

1. Set environment:
```env
NODE_ENV=production
```

2. Use strong JWT_SECRET (32+ characters)

3. Configure SSL/HTTPS

4. Use environment-specific database

5. Enable production logging

6. Run with PM2 or similar:
```bash
npm install -g pm2
pm2 start src/server.js --name daymap-api
```

### Frontend

1. Build production version:
```bash
npm run build
```

2. Serve `build/` folder with:
   - Nginx
   - Apache
   - Serve package
   - Vercel/Netlify

3. Update `.env` with production API URL

## Development Workflow

### Running Both Servers

Keep both terminals open:

**Terminal 1 (Backend):**
```bash
cd c:\xampp\htdocs\DayMap\backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd c:\xampp\htdocs\DayMap\frontend
npm start
```

### Making Changes

1. Backend changes auto-reload with nodemon
2. Frontend changes hot-reload automatically
3. Database changes require manual migration

### Testing API Endpoints

Use tools like:
- Postman
- Thunder Client (VS Code extension)
- curl
- Browser fetch/axios

## Next Steps

1. ✅ Complete setup
2. 📚 Read API documentation (docs/API.md)
3. 🎨 Customize styles and branding
4. 🔧 Add additional features
5. 🚀 Deploy to production

## Getting Help

- Check README.md for overview
- Read API.md for endpoint documentation
- Check browser console for frontend errors
- Check terminal for backend errors
- Review MySQL logs for database issues

---

**Happy coding! 🎉**

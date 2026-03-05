# DayMap - Quick Start Guide

## 🎉 What Has Been Created

I've generated a complete **Daily Routine & Workload Management System** following MVC architecture with:

### ✅ Backend (Node.js + Express + MySQL)
- **MVC Architecture**: Models, Controllers, Routes
- **Authentication**: JWT-based with bcrypt password hashing
- **Database**: Complete MySQL schema with 6 tables
- **Security**: Helmet, CORS, Rate limiting, Input validation
- **API**: 30+ RESTful endpoints
- **Features**: Tasks, Categories, Routines, Analytics

### ✅ Frontend (React.js)
- **Pages**: Login, Register, Dashboard, Today View, Week View, Tasks, Routines, Analytics, Settings
- **Components**: Reusable Button, Input, PrivateRoute components
- **State Management**: React Context API (Auth, Tasks, Theme)
- **Services**: Complete API integration layer
- **Styling**: Custom CSS with dark mode support

### ✅ Documentation
- README.md - Project overview
- API.md - Complete API documentation
- SETUP.md - Detailed setup instructions

## 🚀 How to Get Started

### Step 1: Install Dependencies

**Backend:**
```bash
cd c:\xampp\htdocs\DayMap\backend
npm install
```

**Frontend:**
```bash
cd c:\xampp\htdocs\DayMap\frontend
npm install
```

### Step 2: Setup Database

1. Start XAMPP and MySQL
2. Run the database schema:
```bash
mysql -u root -p < c:\xampp\htdocs\DayMap\database\schema.sql
```

### Step 3: Configure Environment Variables

**Backend** (`backend/.env`):
```bash
cd backend
copy .env.example .env
```
Edit `.env` and set your MySQL password and JWT secret.

**Frontend** (`frontend/.env`):
```bash
cd frontend
copy .env.example .env
```
(Default settings should work)

### Step 4: Start Servers

**Terminal 1 - Backend:**
```bash
cd c:\xampp\htdocs\DayMap\backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd c:\xampp\htdocs\DayMap\frontend
npm start
```

### Step 5: Access Application

Open browser: `http://localhost:3000`

- Register a new account
- Login
- Start creating tasks!

## 📁 Project Structure

```
DayMap/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── config/            # Database, JWT, Environment
│   │   ├── models/            # User, Task, Category, Routine, Analytics
│   │   ├── controllers/       # Business logic (MVC Controllers)
│   │   ├── routes/            # API endpoints
│   │   ├── middleware/        # Auth, Validation, Error handling
│   │   ├── app.js             # Express app
│   │   └── server.js          # Server entry
│   ├── .env.example           # Environment template
│   └── package.json           # Dependencies
│
├── frontend/                   # React.js Application
│   ├── public/
│   │   ├── index.html
│   │   └── manifest.json
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   ├── context/           # Auth, Tasks, Theme contexts
│   │   ├── pages/             # Login, Register, Dashboard, etc.
│   │   ├── services/          # API services
│   │   ├── App.jsx            # Main app
│   │   └── index.js           # Entry point
│   ├── .env.example
│   └── package.json
│
├── database/
│   └── schema.sql             # MySQL database schema
│
├── docs/
│   ├── API.md                 # API documentation
│   └── SETUP.md               # Setup guide
│
├── .gitignore
└── README.md                  # Main documentation
```

## 🔑 Key Features Implemented

### Authentication
- ✅ User registration with validation
- ✅ Login with JWT tokens
- ✅ Password hashing with bcrypt
- ✅ Protected routes
- ✅ Profile management

### Tasks
- ✅ Create, read, update, delete tasks
- ✅ Schedule with date and time
- ✅ Set duration and priority
- ✅ Mark as complete
- ✅ Filter by status, priority, date
- ✅ Today's tasks view
- ✅ Week view

### Categories
- ✅ Create custom categories
- ✅ Color coding
- ✅ Assign to tasks

### Routines
- ✅ Create morning/evening routines
- ✅ Template-based tasks
- ✅ Apply routines to create tasks
- ✅ Activate/deactivate routines

### Analytics
- ✅ Daily statistics
- ✅ Weekly summaries
- ✅ Monthly reports
- ✅ Completion rates
- ✅ Time tracking
- ✅ Productivity trends

### Security
- ✅ JWT authentication
- ✅ Password hashing (bcrypt)
- ✅ SQL injection protection
- ✅ CORS protection
- ✅ Rate limiting
- ✅ Input validation
- ✅ Helmet security headers

## 📊 Database Schema

**Tables Created:**
1. `users` - User accounts
2. `tasks` - Task management
3. `categories` - Task categories
4. `routines` - Routine templates
5. `routine_tasks` - Tasks within routines
6. `analytics` - Usage analytics

## 🔧 Technologies Used

### Backend
- Node.js 18+
- Express.js (Web framework)
- MySQL2 (Database driver)
- JWT (Authentication)
- Bcrypt (Password hashing)
- Express Validator (Input validation)
- Helmet (Security)
- CORS (Cross-origin requests)
- Morgan (Logging)

### Frontend
- React 18
- React Router DOM (Navigation)
- Context API (State management)
- Axios (HTTP client)
- CSS3 (Styling)

## 🎯 Next Steps

1. **Install dependencies** (see Step 1 above)
2. **Setup database** (see Step 2 above)
3. **Configure environment** (see Step 3 above)
4. **Start servers** (see Step 4 above)
5. **Test the application**
6. **Customize and extend features**

## 📚 Additional Resources

- [README.md](../README.md) - Full project documentation
- [API.md](./API.md) - Complete API reference
- [SETUP.md](./SETUP.md) - Detailed setup guide

## ⚡ Quick Commands Reference

```bash
# Backend
cd backend
npm install              # Install dependencies
npm run dev             # Start development server
npm start               # Start production server

# Frontend  
cd frontend
npm install              # Install dependencies
npm start               # Start development server
npm run build           # Build for production

# Database
mysql -u root -p < database/schema.sql    # Create database
```

## 🐛 Troubleshooting

**Issue: Backend won't start**
- Check MySQL is running
- Verify .env configuration
- Check port 5000 is available

**Issue: Frontend won't connect**
- Verify backend is running on port 5000
- Check REACT_APP_API_URL in frontend/.env
- Check browser console for errors

**Issue: Database errors**
- Verify database exists: `SHOW DATABASES;`
- Check tables exist: `SHOW TABLES;`
- Verify credentials in backend/.env

## 📞 Support

For detailed help:
- Check [SETUP.md](./SETUP.md) for setup issues
- Check [API.md](./API.md) for API questions
- Check browser/terminal console for errors

---

## 🎓 Learning the Codebase

**Start with:**
1. `backend/src/server.js` - Entry point
2. `backend/src/app.js` - Express setup
3. `backend/src/routes/` - API endpoints
4. `backend/src/controllers/` - Business logic
5. `backend/src/models/` - Database operations

**Frontend:**
1. `frontend/src/index.js` - Entry point
2. `frontend/src/App.jsx` - Main component
3. `frontend/src/pages/` - Page components
4. `frontend/src/services/` - API calls
5. `frontend/src/context/` - State management

---

**Built with ❤️ following best practices and MVC architecture**

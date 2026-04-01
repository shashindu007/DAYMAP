# DayMap - Daily Routine & Workload Management System

A comprehensive web-based to-do list application built with React.js, Node.js, Express.js, and MySQL following MVC architecture. Track daily routines, manage time effectively, and balance workload for improved productivity.

## 🚀 Features

- **User Authentication** - JWT-based login/register with protected routes
- **Task Management** - Create, list, update, complete, delete, filter, and search tasks
- **Today View** - Daily progress, quick add-task modal, and completion tracking
- **Dashboard** - Profile details, all-task overview, time analysis, and most-used section insights
- **Task Status Workflows** - Pending, in-progress, completed, cancelled lifecycle support
- **Backend Analytics APIs** - Daily/weekly/monthly summary and trend endpoints
- **Responsive UI Foundation** - Mobile-friendly layouts for core pages

## ✅ Current Implementation Status (April 2026)

### Working in UI
- Authentication pages (`/login`, `/register`)
- Dashboard (`/dashboard`) with:
    - profile information
    - all-task listing
    - task/time summary metrics
    - route usage analysis (most frequently used app sections)
- Today view (`/today`) with task creation + completion
- Tasks page (`/tasks`) with search, status filtering, mark done, delete
- Settings page (`/settings`) with profile preview + logout

### Implemented in API (available to frontend)
- Auth endpoints under `/api/auth/*`
- Full task endpoints under `/api/tasks/*`
- Category endpoints under `/api/categories/*`
- Routine endpoints under `/api/routines/*`
- Analytics endpoints under `/api/analytics/*`

### Placeholder / In Progress in UI
- Week view page (`/week`) still placeholder UI
- Routines page (`/routines`) still placeholder UI
- Analytics page (`/analytics`) still placeholder UI (APIs exist)

## 🛠️ Tech Stack

### Backend
- Node.js (v18+)
- Express.js (RESTful API)
- MySQL 8.0+ (Database)
- JWT (Authentication)
- bcryptjs (Password hashing)

### Frontend
- React.js 18+
- React Router DOM (Navigation)
- Context API (State management)
- Axios (HTTP client)
- CSS3 (Styling)

## 📁 Project Structure

```
DayMap/
├── backend/                    # Backend API
│   ├── src/
│   │   ├── config/            # Configuration files
│   │   ├── controllers/       # Route controllers (MVC)
│   │   ├── models/            # Database models (MVC)
│   │   ├── routes/            # API routes
│   │   ├── middleware/        # Custom middleware
│   │   ├── app.js            # Express app setup
│   │   └── server.js         # Server entry point
│   └── package.json
├── frontend/                   # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   ├── context/          # React Context
│   │   ├── pages/            # Page components
│   │   ├── services/         # API services
│   │   ├── App.jsx           # Main App component
│   │   └── index.js          # Entry point
│   └── package.json
└── database/                   # Database files
    └── schema.sql             # Database schema
```

## 🔧 Installation & Setup

### Prerequisites

- Node.js (v18 or higher)
- MySQL (v8.0 or higher)
- npm or yarn
- XAMPP (for local MySQL server)

### 1. Clone the Repository

```bash
cd c:\xampp\htdocs\DayMap
```

### 2. Database Setup

1. Start MySQL server (via XAMPP or standalone)
2. Create the database:

```bash
mysql -u root -p < database/schema.sql
```

Or manually:
```sql
CREATE DATABASE routine_tracker;
USE routine_tracker;
-- Then run the schema.sql content
```

### 3. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_NAME=routine_tracker
DB_USER=root
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key_here
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:3000
```

Start the backend server:
```bash
npm run dev
```

Backend will run at `http://localhost:5000`

### 4. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_API_TIMEOUT=10000
```

Start the frontend:
```bash
npm start
```

Frontend will run at `http://localhost:3000`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/update-profile` - Update profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout

### Tasks
- `GET /api/tasks` - Get all tasks (with filters)
- `GET /api/tasks/today` - Get today's tasks
- `GET /api/tasks/week` - Get week's tasks
- `GET /api/tasks/:id` - Get single task
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `PATCH /api/tasks/:id/complete` - Mark as complete
- `POST /api/tasks/bulk-delete` - Bulk delete

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Routines
- `GET /api/routines` - Get all routines
- `POST /api/routines` - Create routine
- `PUT /api/routines/:id` - Update routine
- `DELETE /api/routines/:id` - Delete routine
- `PATCH /api/routines/:id/activate` - Toggle active
- `POST /api/routines/:id/apply` - Apply routine

### Analytics
- `GET /api/analytics/daily/:date` - Daily analytics
- `GET /api/analytics/weekly` - Weekly analytics
- `GET /api/analytics/monthly` - Monthly analytics
- `GET /api/analytics/summary` - Overall summary
- `GET /api/analytics/trends` - Productivity trends

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt (10 rounds)
- SQL injection prevention (parameterized queries)
- CORS protection
- Rate limiting
- Input validation
- Helmet.js security headers

## 🧪 Testing

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## 📦 Building for Production

### Backend
```bash
cd backend
npm start
```

### Frontend
```bash
cd frontend
npm run build
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👥 Author

DayMap Development Team

## 📞 Support

For support, email support@daymap.com or open an issue in the repository.

## 🗺️ Roadmap

- [ ] Complete Week View interactive planner UI
- [ ] Build full Routines management UI on top of existing routine APIs
- [ ] Build Analytics charts page on top of analytics APIs
- [ ] Real-time notifications/reminders
- [ ] Calendar integrations (Google, Outlook)
- [ ] Team collaboration features
- [ ] Mobile app (iOS/Android)
- [ ] AI-powered task suggestions

---

**Made with ❤️ for better productivity**

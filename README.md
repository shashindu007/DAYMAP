# DayMap - Daily Routine & Workload Management System

A comprehensive web-based to-do list application built with React.js, Node.js, Express.js, and MySQL following MVC architecture. Track daily routines, manage time effectively, and balance workload for improved productivity.

## 🚀 Features

- **Time-Based Task Management** - Schedule tasks with specific times and durations
- **Daily Routine Tracking** - Create and manage recurring routines
- **Workload Visualization** - Visual capacity and progress tracking
- **Analytics Dashboard** - Productivity insights and trends
- **User Authentication** - Secure JWT-based authentication
- **Responsive Design** - Works seamlessly on desktop and mobile

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

- [ ] Mobile app (iOS/Android)
- [ ] Real-time notifications
- [ ] Team collaboration features
- [ ] AI-powered task suggestions
- [ ] Calendar integrations (Google, Outlook)
- [ ] Pomodoro timer
- [ ] Voice input
- [ ] Dark mode enhancements

---

**Made with ❤️ for better productivity**

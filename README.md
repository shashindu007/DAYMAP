# DayMap

Daily routine and workload management system built with **React + Node.js + Express + MySQL** using a clear MVC backend and service/context-driven frontend.

This document explains the project **from A to Z**: architecture, components, request flow, user flow, setup, and how all implemented parts work together.

---

## 1) What DayMap does

DayMap helps users:

- register and securely log in
- create, schedule, update, complete, and delete tasks
- group work with categories
- build reusable routines and apply them to a selected date
- track productivity with daily/weekly/monthly analytics and trends
- view usage behavior inside the app (route usage summary)

---

## 2) Current implementation status (April 2026)

### Fully implemented backend modules

- Authentication (`/api/auth`)
- Tasks (`/api/tasks`)
- Categories (`/api/categories`)
- Routines (`/api/routines`)
- Analytics (`/api/analytics`)
- Validation, auth middleware, rate limiting, global error handling

### Implemented frontend pages

- `Login` (`/login`)
- `Register` (`/register`)
- `Dashboard` (`/dashboard`)
- `TodayView` (`/today`)
- `Tasks` (`/tasks`)
- `Routines` (`/routines`)
- `Analytics` (`/analytics`)
- `Settings` (`/settings`)
- `WeekView` (`/week`) → minimal placeholder page (basic scaffold)

---

## 3) Technology stack

### Backend

- Node.js 18+
- Express 4
- MySQL 8 (`mysql2/promise` pool)
- JWT (`jsonwebtoken`)
- `bcryptjs` for password hashing
- `express-validator` for request validation
- `express-rate-limit`, `helmet`, `cors`, `morgan`

### Frontend

- React 18
- React Router 6
- Context API for app-level state
- Axios service layer with interceptors
- CSS-based UI

---

## 4) Project structure

```text
DayMap/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   ├── env.js
│   │   │   └── jwt.js
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   └── routes/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/common/
│   │   ├── context/
│   │   ├── pages/
│   │   └── services/
│   └── package.json
├── database/
│   └── schema.sql
├── docs/
│   ├── API.md
│   └── SETUP.md
└── README.md
```

---

## 5) A-to-Z runtime workflow (system flow)

### A. App startup

1. Backend starts from `backend/src/server.js`.
2. Environment variables are loaded.
3. DB connection is verified via `testConnection()`.
4. Express app (`backend/src/app.js`) is mounted with middleware and routes.
5. Frontend starts from `frontend/src/index.js` and renders `App`.

### B. Request lifecycle (backend)

For API requests:

1. `helmet` + `cors` + body parsers + logging
2. General rate limiter on `/api/*`
3. Route matching (`/api/auth`, `/api/tasks`, etc.)
4. Route-specific validation middleware (where configured)
5. Auth middleware (protected routes)
6. Controller business logic
7. Model database operations
8. JSON response returned
9. If unmatched route → `notFound` handler
10. If exception/error → global `errorHandler`

### C. Frontend data lifecycle

1. React page/component calls a service (e.g., `taskService`).
2. Service uses shared `api` client (`frontend/src/services/api.js`).
3. Axios request interceptor adds `Authorization: Bearer <token>` when available.
4. API response interceptor returns normalized `response.data`.
5. Context state (`AuthContext`/`TaskContext`) updates UI.
6. On `401`, session is cleared and user is redirected to `/login`.

---

## 6) Authentication flow (end-to-end)

### Backend

- Routes: `backend/src/routes/authRoutes.js`
- Controller: `backend/src/controllers/authController.js`
- Model: `backend/src/models/User.js`

Implemented actions:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/update-profile`
- `PUT /api/auth/change-password`
- `POST /api/auth/logout`

Key behavior:

- password hashing via `bcryptjs`
- JWT access and refresh token generation
- protected route checks via `authMiddleware`
- user ownership and existence checks

### Frontend

- Context: `frontend/src/context/AuthContext.jsx`
- Service: `frontend/src/services/authService.js`
- Pages: `Login`, `Register`
- Route protection shell: `frontend/src/components/common/PrivateRoute.jsx`

Key behavior:

- session is stored in `localStorage` (`token`, `user`)
- app validates current session on initial load
- protected pages are blocked without authentication

---

## 7) Task management flow (end-to-end)

### Backend

- Routes: `backend/src/routes/taskRoutes.js`
- Controller: `backend/src/controllers/taskController.js`
- Model: `backend/src/models/Task.js`

Implemented endpoints:

- `GET /api/tasks`
- `GET /api/tasks/today`
- `GET /api/tasks/week`
- `GET /api/tasks/upcoming`
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `PATCH /api/tasks/:id/complete`
- `PATCH /api/tasks/:id/status`
- `POST /api/tasks/bulk-delete`

Key behavior:

- filtering by status/priority/category/date
- ownership verification per task
- status workflow (`pending`, `in_progress`, `completed`, `cancelled`)
- on create/update/delete/complete, related analytics can be recalculated

### Frontend

- Context: `frontend/src/context/TaskContext.jsx`
- Service: `frontend/src/services/taskService.js`
- Pages: `TodayView`, `Tasks`, `Dashboard`

Key behavior:

- `TodayView`: today-focused task list and add-task modal
- `Tasks`: search + status filter + mark done + delete
- `Dashboard`: overall task stats and task-time support UI

---

## 8) Category flow

### Backend

- Routes: `backend/src/routes/categoryRoutes.js`
- Controller: `backend/src/controllers/categoryController.js`
- Model: `backend/src/models/Category.js`

Implemented endpoints:

- `GET /api/categories`
- `GET /api/categories/:id`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`

Key behavior:

- per-user categories
- duplicate category-name protection per user
- ownership checks on read/update/delete

### Frontend

- Service: `frontend/src/services/categoryService.js`
- Used by pages/features that need category CRUD integration

---

## 9) Routine flow

### Backend

- Routes: `backend/src/routes/routineRoutes.js`
- Controller: `backend/src/controllers/routineController.js`
- Models: `Routine`, `RoutineTask`, `Task`

Implemented endpoints:

- `GET /api/routines`
- `GET /api/routines/:id`
- `POST /api/routines`
- `PUT /api/routines/:id`
- `DELETE /api/routines/:id`
- `PATCH /api/routines/:id/activate`
- `POST /api/routines/:id/apply`

Key behavior:

- routines store ordered template tasks (`routine_tasks.task_template` JSON)
- applying a routine generates real tasks for a selected date
- active/inactive toggle support

### Frontend

- Page: `frontend/src/pages/Routines.jsx`
- Service: `frontend/src/services/routineService.js`

Key behavior:

- create routine with multiple template tasks
- apply routine to chosen date
- activate/deactivate/delete routines

---

## 10) Analytics flow

### Backend

- Routes: `backend/src/routes/analyticsRoutes.js`
- Controller: `backend/src/controllers/analyticsController.js`
- Model: `backend/src/models/Analytics.js`

Implemented endpoints:

- `GET /api/analytics/daily/:date`
- `GET /api/analytics/weekly`
- `GET /api/analytics/monthly`
- `GET /api/analytics/summary`
- `GET /api/analytics/trends`

Key behavior:

- supports custom date ranges (weekly/monthly/trends)
- completion rate calculations
- summary aggregation across analytics records

### Frontend

- Page: `frontend/src/pages/Analytics.jsx`
- Service: `frontend/src/services/analyticsService.js`

Key behavior:

- filters by date and trend window
- displays summary, daily/weekly/monthly cards, trend table
- also displays local task-clock tracked minutes for comparison

---

## 11) Dashboard + usage tracking flow

### Files

- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/services/usageService.js`
- `frontend/src/App.jsx` (route tracking integration)

How it works:

- route transitions are recorded in local storage (`daymap_route_usage_v1`)
- service computes visits and estimated time per route
- dashboard reads and shows most-used sections and time insights

---

## 12) Implemented frontend components

### Common components

- `Button.jsx` + styles
- `Input.jsx` + styles
- `PrivateRoute.jsx` + app-shell/nav layout

### Context providers

- `AuthProvider`
- `TaskProvider`
- `ThemeProvider` (dark mode toggle state + html class)

### Service layer

- `api.js` (axios client + interceptors)
- `authService.js`
- `taskService.js`
- `categoryService.js`
- `routineService.js`
- `analyticsService.js`
- `usageService.js`

---

## 13) Database design

Schema file: `database/schema.sql`

Implemented tables:

1. `users`
2. `categories`
3. `tasks`
4. `routines`
5. `routine_tasks`
6. `analytics`

Highlights:

- UUID primary keys
- foreign keys with cascade behaviors
- indexes for user/date/status filtering
- enum constraints for priority/status/routine type
- JSON fields for recurrence patterns and routine task templates

---

## 14) Security and reliability features

Implemented protections:

- JWT auth with server-side verification
- password hashing (`bcrypt` rounds configurable)
- secure headers via `helmet`
- CORS origin restriction
- request validation (`express-validator`)
- API and auth rate limiting
- centralized error formatting
- graceful startup checks for DB connectivity

---

## 15) Environment variables

### Backend (`backend/.env`)

- `PORT`
- `NODE_ENV`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRE`
- `JWT_REFRESH_EXPIRE`
- `CORS_ORIGIN`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`
- `BCRYPT_ROUNDS`

### Frontend (`frontend/.env`)

- `REACT_APP_API_URL`
- `REACT_APP_API_TIMEOUT`

---

## 16) Local setup and run

### Prerequisites

- Node.js 18+
- npm
- MySQL 8+
- Windows/XAMPP (recommended for this workspace)

### Step 1: Database

Run `database/schema.sql` into MySQL to create `routine_tracker` and all tables.

### Step 2: Backend

In `backend/`:

- install dependencies
- configure `.env`
- run development server (`npm run dev`)

### Step 3: Frontend

In `frontend/`:

- install dependencies
- configure `.env`
- run app (`npm start`)

### Default URLs

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- Health check: `http://localhost:5000/health`

---

## 17) Validation and constraints implemented

Examples of enforced rules:

- email format validity
- password complexity (min 8 + uppercase + lowercase + number)
- UUID checks for `:id` params
- date format (`YYYY-MM-DD`)
- time format (`HH:MM:SS`)
- task priority/status value constraints
- routine type constraints

---

## 18) Known gaps / future improvements

- `WeekView` page UI is still a simple placeholder
- richer UI data visualizations (charts) can be expanded
- automated tests are not yet comprehensive across all modules
- refresh-token rotation strategy can be expanded for production hardening

---

## 19) Developer orientation map

If you are new to this codebase, start here:

1. `backend/src/server.js`
2. `backend/src/app.js`
3. `backend/src/routes/*`
4. `backend/src/controllers/*`
5. `backend/src/models/*`
6. `frontend/src/App.jsx`
7. `frontend/src/context/*`
8. `frontend/src/services/*`
9. `frontend/src/pages/*`

This sequence gives you the fastest understanding of the full system.

---

## 20) Additional docs

- Setup guide: `docs/SETUP.md`
- API reference: `docs/API.md`
- Quick start: `QUICKSTART.md`

---

## 21) Summary

DayMap is already a **working full-stack productivity platform** with implemented authentication, task management, categories, routines, analytics, and protected frontend routing.

From user login to analytics reporting, the complete flow is implemented and connected across:

- React pages/components/context/services
- Express middleware/routes/controllers
- MySQL-backed models and schema

In short: the foundation is production-minded, modular, and easy to extend.

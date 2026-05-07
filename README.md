# DayMap

Daily routine and workload management system built with **React + Node.js + Express + MongoDB (Mongoose)** using a clean MVC backend and service/context-driven frontend.

This README explains the implemented workflow end-to-end and documents the MongoDB migration.

---

## What DayMap does

- secure user authentication (JWT)
- task planning and status tracking
- category management
- routine templates + routine application to daily tasks
- analytics (daily/weekly/monthly/summary/trends)
- route usage tracking on frontend dashboard

---

## Current stack

### Backend
- Node.js 18+
- Express 4
- MongoDB + Mongoose
- bcryptjs
- jsonwebtoken
- express-validator
- helmet, cors, morgan, express-rate-limit

### Frontend
- React 18
- React Router DOM
- Context API
- Axios

---

## Project structure

```text
DayMap/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   └── routes/
│   ├── .env.example
│   └── package.json
├── frontend/
├── docs/
│   ├── API.md
│   ├── SETUP.md
│   └── MONGODB_MIGRATION.md
└── README.md
```

---

## A-to-Z backend request flow

1. `server.js` loads env and connects to MongoDB.
2. `app.js` registers middleware (security, parser, logging, rate limit).
3. Request hits route (`/api/auth`, `/api/tasks`, etc.).
4. Validation middleware checks payload/query/params.
5. Auth middleware verifies JWT for protected routes.
6. Controller executes business logic.
7. Model executes Mongoose queries/aggregations.
8. JSON response returned.
9. Errors pass to global error handler.

---

## Implemented API modules

- **Auth**: register/login/me/profile/password/logout
- **Tasks**: full CRUD + today/week/upcoming + status + bulk delete
- **Categories**: full CRUD
- **Routines**: full CRUD + activate/deactivate + apply
- **Analytics**: daily/weekly/monthly/summary/trends

Routes remain unchanged from the previous SQL version.

---

## MongoDB migration summary

Completed migration requirements:

- removed SQL query code and SQL pool configuration
- added MongoDB connection via Mongoose (`backend/src/config/database.js`)
- converted all models to Mongoose schemas:
  - `User`, `Task`, `Category`, `Routine`, `RoutineTask`, `Analytics`
- replaced SQL CRUD with Mongoose operations (`find`, `findOne`, `create`, `updateOne`, `deleteOne`, `aggregate`)
- updated validation to support both UUID/ObjectId formats during transition
- updated error handling for Mongo duplicate key and cast errors
- updated backend environment to use `MONGODB_URI`
- added migration doc with SQL→Mongoose example:
  - `docs/MONGODB_MIGRATION.md`

---

## Environment variables

### Backend (`backend/.env`)

- `PORT`
- `NODE_ENV`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
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

## Local run

### Backend

- install dependencies in `backend/`
- set `backend/.env`
- run development server (`npm run dev`)

### Frontend

- install dependencies in `frontend/`
- set `frontend/.env`
- run frontend (`npm start`)

Default:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3010`
- Health: `http://localhost:3010/health`

---

## Notes on schema design

- Model relationships are maintained via reference fields (`id`, `user_id`, `routine_id`, etc.).
- Indexes are added for critical query paths and uniqueness.
- Task date/time fields are kept as strings (`YYYY-MM-DD`, `HH:MM:SS`) for API compatibility.

---

## Additional docs

- Setup guide: `docs/SETUP.md`
- API reference: `docs/API.md`
- Mongo migration details + SQL→Mongoose example: `docs/MONGODB_MIGRATION.md`

---

## Final summary

DayMap backend has been migrated from SQL to MongoDB/Mongoose while keeping route contracts stable and preserving application behavior.

# DayMap Setup Guide (MongoDB)

## Prerequisites

- Node.js 18+
- npm
- MongoDB 6+ (local install or Atlas connection string)

## 1) Project location

Expected workspace path:

`c:\xampp\htdocs\DayMap`

## 2) Backend setup

1. Open terminal and go to backend folder.
2. Install dependencies.
3. Create `.env` from `.env.example`.
4. Set Mongo connection:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/daymap
MONGODB_DB_NAME=daymap
```

5. Start backend:

- development: `npm run dev`
- production: `npm start`

If successful, backend logs show MongoDB connection and server startup.

## 3) Frontend setup

1. Open a second terminal and go to frontend folder.
2. Install dependencies.
3. Configure frontend `.env`:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_API_TIMEOUT=10000
```

4. Start frontend: `npm start`

## 4) Verify

- `http://localhost:5000/health` returns success JSON
- `http://localhost:3000` opens DayMap login/register

## 5) Common issues

### Mongo connection error
- verify MongoDB service is running
- verify `MONGODB_URI` is correct
- if using Atlas, whitelist IP and ensure credentials are correct

### Port conflict
- change backend `PORT`
- update frontend `REACT_APP_API_URL`

### Auth/token issues
- verify `JWT_SECRET` in backend `.env`
- clear browser localStorage and login again

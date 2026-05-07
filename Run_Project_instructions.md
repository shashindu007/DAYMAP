# Run_Project_instructions

This guide explains how to run **DayMap** on Windows for beginner-level programmers. It follows the same steps we used to bring the project up.

---

## ✅ Prerequisites

Make sure you already have:

- **Node.js 18+** (includes npm)
- **Docker Desktop** (for MongoDB)

---

## ✅ Step 1 — Start MongoDB (Docker)

We already have a MongoDB container named `daymap-mongo`. Start it with:

1. Open **Docker Desktop**
2. Go to **Containers**
3. Click the **Play ▶** button next to `daymap-mongo`

If it runs, MongoDB will be available on:

```
mongodb://127.0.0.1:27017/daymap
```

---

## ✅ Step 2 — Start Backend (API server)

Open a terminal in the project root and run:

1. Go into the backend folder:

```
cd backend
```

2. Start the development server:

```
npm run dev
```

When it works, you will see:

- ✅ MongoDB connected
- 🚀 Server running on port **3010**

You can check the backend health here:

```
http://localhost:3010/health
```

---

## ✅ Step 3 — Start Frontend (React app)

Open **another terminal** and run:

1. Go into frontend folder:

```
cd frontend
```

2. Start React app:

```
npm start
```

When it works, you will see the URL like:

```
http://localhost:3006
```

---

## ✅ Step 4 — Open the App

Open your browser and visit:

```
http://localhost:3006
```

You should see the DayMap login page.

---

## ✅ Common Problems (Quick Fix)

### ❌ "No response from server"
Backend is not running or MongoDB is not started.

✅ Fix:
- Start Docker container `daymap-mongo`
- Restart backend: `npm run dev`

---

### ❌ MongoDB connection error
MongoDB not running.

✅ Fix:
- Open Docker Desktop and start container

---

### ❌ Port already in use
Another app is using port 3010 or 3006.

✅ Fix:
- Close the other app or change port in `.env` files

---

## ✅ Done

Now you can log in and use DayMap 🎉

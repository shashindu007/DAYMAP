# DayMap API Documentation

## Base URL
```
http://localhost:3010/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Authentication Endpoints

### Register User

**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "timezone": "UTC"
}
```

**Response:** (201 Created)
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "john@example.com",
      "name": "John Doe",
      "timezone": "UTC"
    },
    "token": "jwt-token-here",
    "refreshToken": "refresh-token-here"
  }
}
```

**Validation Rules:**
- Email must be valid and unique
- Password minimum 8 characters with uppercase, lowercase, and number
- Name 2-100 characters

---

### Login

**POST** `/auth/login`

Authenticate user and receive token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "john@example.com",
      "name": "John Doe"
    },
    "token": "jwt-token-here",
    "refreshToken": "refresh-token-here"
  }
}
```

---

### Get Current User

**GET** `/auth/me`

Get currently authenticated user details.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "email": "john@example.com",
    "name": "John Doe",
    "timezone": "UTC",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Task Endpoints

### Get All Tasks

**GET** `/tasks`

Get all tasks for authenticated user with optional filters.

**Query Parameters:**
- `status` - Filter by status (pending, in_progress, completed, cancelled)
- `priority` - Filter by priority (low, medium, high, urgent)
- `category` - Filter by category name
- `scheduled_date` - Filter by specific date (YYYY-MM-DD)
- `date_from` - Filter from date (YYYY-MM-DD)
- `date_to` - Filter to date (YYYY-MM-DD)

**Example:**
```
GET /tasks?status=pending&priority=high
```

**Response:** (200 OK)
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "uuid-here",
        "title": "Morning Workout",
        "description": "30 minutes cardio",
        "category": "Health",
        "priority": "high",
        "status": "pending",
        "scheduled_date": "2024-02-09",
        "scheduled_time": "06:00:00",
        "duration_minutes": 30,
        "is_recurring": true,
        "created_at": "2024-02-09T00:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

---

### Get Today's Tasks

**GET** `/tasks/today`

Get all tasks scheduled for today.

**Response:** (200 OK)
```json
{
  "success": true,
  "data": {
    "tasks": [...],
    "total_tasks": 8,
    "completed_tasks": 3,
    "total_scheduled_minutes": 420,
    "completion_percentage": 37.5
  }
}
```

---

### Create Task

**POST** `/tasks`

Create a new task.

**Request Body:**
```json
{
  "title": "Team Meeting",
  "description": "Discuss project roadmap",
  "category": "Work",
  "priority": "high",
  "scheduled_date": "2024-02-09",
  "scheduled_time": "10:00:00",
  "duration_minutes": 60,
  "is_recurring": false
}
```

**Response:** (201 Created)
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "id": "uuid-here",
    "title": "Team Meeting",
    "status": "pending",
    ...
  }
}
```

**Validation Rules:**
- Title required, max 255 characters
- Date format: YYYY-MM-DD
- Time format: HH:MM:SS
- Duration must be positive integer
- Priority: low|medium|high|urgent
- Status: pending|in_progress|completed|cancelled

---

### Update Task

**PUT** `/tasks/:id`

Update an existing task.

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "priority": "urgent",
  "scheduled_time": "11:00:00"
}
```

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Task updated successfully",
  "data": {...}
}
```

---

### Complete Task

**PATCH** `/tasks/:id/complete`

Mark a task as completed.

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Task marked as complete",
  "data": {
    "id": "uuid-here",
    "status": "completed",
    "completed_at": "2024-02-09T12:00:00.000Z",
    ...
  }
}
```

---

### Delete Task

**DELETE** `/tasks/:id`

Delete a task.

**Response:** (200 OK)
```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

---

## Routine Endpoints

### Get Routine Templates

**GET** `/routines`

Optional query:
- `active_only=true`

**Response:**
```json
{
  "success": true,
  "data": {
    "routines": [
      {
        "id": "uuid",
        "name": "Morning Routine",
        "recurrence": { "type": "daily" },
        "items": [
          { "id": "uuid", "title": "Wake up", "duration_minutes": 10, "order": 0 }
        ]
      }
    ]
  }
}
```

### Create Routine Template

**POST** `/routines`

```json
{
  "name": "Morning Routine",
  "description": "Start strong",
  "color": "#6366F1",
  "icon": "☀️",
  "is_active": true,
  "recurrence": { "type": "weekdays" },
  "items": [
    { "title": "Wake up", "duration_minutes": 10, "order": 0 },
    { "title": "Exercise", "duration_minutes": 30, "order": 1 }
  ]
}
```

### Update Routine Template

**PUT** `/routines/:id`

### Delete Routine Template

**DELETE** `/routines/:id`

### Get Daily Routine

**GET** `/routines/daily/:date`

Returns routine instances for the date (auto-generated from templates) plus the day schedule.

### Update Routine Instance Item

**PATCH** `/routines/instances/:id/items/:itemId`

### Complete / Skip Routine Item

**PATCH** `/routines/instances/:id/items/:itemId/complete`

```json
{ "status": "completed" }
```

### Routine Analytics (Daily)

**GET** `/routines/analytics/:date`

---

## Analytics Endpoints

### Get Daily Analytics

**GET** `/analytics/daily/:date`

Get analytics for a specific date.

**Example:**
```
GET /analytics/daily/2024-02-09
```

**Response:** (200 OK)
```json
{
  "success": true,
  "data": {
    "date": "2024-02-09",
    "total_tasks_scheduled": 8,
    "total_tasks_completed": 6,
    "total_time_scheduled_minutes": 420,
    "total_time_spent_minutes": 390,
    "completion_rate": 75.00
  }
}
```

---

### Get Weekly Analytics

**GET** `/analytics/weekly`

Get analytics for the current week or specified date range.

**Query Parameters:**
- `start_date` - Week start date (YYYY-MM-DD)
- `end_date` - Week end date (YYYY-MM-DD)

**Response:** (200 OK)
```json
{
  "success": true,
  "data": {
    "start_date": "2024-02-05",
    "end_date": "2024-02-11",
    "daily": [...],
    "totals": {
      "total_tasks_scheduled": 56,
      "total_tasks_completed": 42,
      "total_time_scheduled_minutes": 2940,
      "total_time_spent_minutes": 2730,
      "completion_rate": 75.00
    }
  }
}
```

---

## Error Responses

All endpoints may return these error responses:

**400 Bad Request**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email"
    }
  ]
}
```

**401 Unauthorized**
```json
{
  "success": false,
  "message": "Invalid or expired token. Authorization denied."
}
```

**404 Not Found**
```json
{
  "success": false,
  "message": "Task not found"
}
```

**429 Too Many Requests**
```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later."
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "message": "Internal Server Error"
}
```

---

## Rate Limiting

- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 requests per 15 minutes
- **Task Creation**: 30 requests per minute

---

## Notes

- All dates use ISO 8601 format (YYYY-MM-DD)
- All times use 24-hour format (HH:MM:SS)
- All timestamps are in UTC
- Token expires in 7 days
- Refresh token expires in 30 days

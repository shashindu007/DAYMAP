# DayMap MongoDB Migration Notes (Mongoose)

This document summarizes the SQL → MongoDB migration implemented for the backend.

## Major changes

1. **SQL connection removed**
   - Removed MySQL pool usage.
   - Added Mongoose connection in `backend/src/config/database.js`.

2. **Models migrated to Mongoose schemas**
   - `User`, `Task`, `Category`, `Routine`, `RoutineTask`, `Analytics`
   - Added schema-level validators (`required`, `enum`, `maxlength`, etc.).
   - Added indexes for uniqueness and query performance.

3. **CRUD layer migrated**
   - Replaced SQL queries with Mongoose methods:
     - `create`, `findOne`, `find`, `updateOne`, `deleteOne`, `deleteMany`, `aggregate`
   - Kept model method names stable to avoid route/API changes.

4. **Error handling updated**
   - Added Mongo duplicate key handling (`err.code === 11000`).
   - Added Mongoose `CastError` mapping.

5. **ID validation updated**
   - Route validation now accepts UUID and Mongo ObjectId format.
   - Existing API routes remain unchanged.

6. **Environment updated**
   - `backend/.env` and `backend/.env.example` now use:
     - `MONGODB_URI`
     - `MONGODB_DB_NAME`

---

## SQL → Mongoose example (User model)

### SQL table (before)

```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC'
);
```

### Mongoose schema (after)

```js
// backend/src/models/User.js
const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, default: uuidv4 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password_hash: { type: String, required: true },
    name: { type: String, required: true, minlength: 2, maxlength: 100, trim: true },
    timezone: { type: String, default: 'UTC', maxlength: 50 }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
  }
);
```

### CRUD mapping example

- SQL: `SELECT * FROM users WHERE email = ?`
- Mongoose: `UserDocument.findOne({ email: email.toLowerCase() }).lean()`

---

## Indexes added (important)

- `users.email` unique
- `categories (user_id, name)` unique
- `tasks (user_id, scheduled_date)`
- `tasks.status`, `tasks.priority`
- `routines (user_id, is_active)`
- `routine_tasks (routine_id, task_order)`
- `analytics (user_id, date)` unique

---

## Performance & schema improvement suggestions

1. **Store date/time as native Date in v2**
   - Current API keeps string date/time for compatibility.
   - A future migration to native Date enables cleaner range queries.

2. **Use lean queries by default on reads**
   - Already used for most reads to reduce memory overhead.

3. **Add query-level projection where possible**
   - Return only fields needed by each endpoint.

4. **Consider transactions for multi-write flows**
   - Example: routine apply creating many tasks + analytics updates.
   - Requires replica set Mongo deployment.

5. **Add request-level caching for analytics-heavy endpoints**
   - Weekly/monthly summary endpoints can benefit from short TTL caches.

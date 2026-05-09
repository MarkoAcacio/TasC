// ============================================================
//  TasC – Express Server
//  npm install express mysql2 bcrypt jsonwebtoken dotenv
// ============================================================

require('dotenv').config()
const express = require('express')
const bcrypt  = require('bcrypt')
const jwt     = require('jsonwebtoken')
const pool    = require('./db')             // ← database connection

const app = express()
app.use(express.json())

// ── ENV ──────────────────────────────────────────────────────
const { JWT_SECRET, PORT = 3000 } = process.env

if (!JWT_SECRET) {
  console.error('ERROR: JWT_SECRET is not set in .env – stopping.')
  process.exit(1)
}

// ── JWT MIDDLEWARE ────────────────────────────────────────────
function authenticate (req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' })
  }
  const token = authHeader.split(' ')[1]
  try {
    req.user = jwt.verify(token, JWT_SECRET)   // { userID, email }
    next()
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid' })
  }
}

// ════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' })
  }

  try {
    // 1. Hash the password (bcrypt, 12 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 12)

    // 2. Insert user – trigger creates usersettings row automatically
    const [result] = await pool.execute(
      `INSERT INTO users (FirstName, LastName, Email, Password)
       VALUES (?, ?, ?, ?)`,
      [firstName, lastName, email, hashedPassword]
    )

    const userID = result.insertId

    // 3. Return the new user (no password)
    res.status(201).json({
      message: 'Registration successful',
      user: { userID, firstName, lastName, email },
    })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered' })
    }
    console.error(err)
    res.status(500).json({ error: 'Server error during registration' })
  }
})

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE Email = ? LIMIT 1',
      [email]
    )
    const user = rows[0]

    if (!user || !(await bcrypt.compare(password, user.Password))) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Sign JWT – expires in 8 hours
    const token = jwt.sign(
      { userID: user.UserID, email: user.Email },
      JWT_SECRET,
      { expiresIn: '8h' }
    )

    res.json({
      message: 'Login successful',
      token,
      user: {
        userID:    user.UserID,
        firstName: user.FirstName,
        lastName:  user.LastName,
        email:     user.Email,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error during login' })
  }
})

// ════════════════════════════════════════════════════════════
//  TASK ROUTES  (all scoped to req.user.userID)
// ════════════════════════════════════════════════════════════

// GET /api/tasks  – list signed-in user's tasks
app.get('/api/tasks', authenticate, async (req, res) => {
  const { userID } = req.user
  const { status, date } = req.query

  let sql    = 'SELECT * FROM tasks WHERE UserID = ?'
  const args = [userID]

  if (status) { sql += ' AND Status = ?';   args.push(status) }
  if (date)   { sql += ' AND TaskDate = ?'; args.push(date)   }

  sql += ' ORDER BY TaskDate ASC, TaskTime ASC'

  try {
    const [tasks] = await pool.execute(sql, args)
    res.json(tasks)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch tasks' })
  }
})

// POST /api/tasks  – create a task for the signed-in user
app.post('/api/tasks', authenticate, async (req, res) => {
  const { userID } = req.user
  const {
    taskName, taskDate, taskTime,
    taskDuration = 30, priority = 'Medium',
    notes = null, sendReminder = 1,
  } = req.body

  if (!taskName || !taskDate || !taskTime) {
    return res.status(400).json({ error: 'taskName, taskDate, taskTime are required' })
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO tasks
         (UserID, TaskName, TaskDate, TaskTime, TaskDuration,
          Priority, Notes, SendReminder)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userID, taskName, taskDate, taskTime, taskDuration,
       priority, notes, sendReminder]
    )

    // Auto-create notification if reminder is requested
    if (sendReminder) {
      const alertTime = `${taskDate} ${taskTime}`
      await pool.execute(
        `INSERT INTO notifications (TaskID, UserID, AlertTime)
         VALUES (?, ?, ?)`,
        [result.insertId, userID, alertTime]
      )
    }

    res.status(201).json({ message: 'Task created', taskID: result.insertId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create task' })
  }
})

// PUT /api/tasks/:id  – update (only if owned by user)
app.put('/api/tasks/:id', authenticate, async (req, res) => {
  const { userID } = req.user
  const taskID = parseInt(req.params.id, 10)
  const {
    taskName, taskDate, taskTime,
    taskDuration, priority, notes,
    status, sendReminder,
  } = req.body

  try {
    // Confirm ownership
    const [rows] = await pool.execute(
      'SELECT TaskID FROM tasks WHERE TaskID = ? AND UserID = ?',
      [taskID, userID]
    )
    if (!rows.length) {
      return res.status(404).json({ error: 'Task not found' })
    }

    await pool.execute(
      `UPDATE tasks SET
         TaskName     = COALESCE(?, TaskName),
         TaskDate     = COALESCE(?, TaskDate),
         TaskTime     = COALESCE(?, TaskTime),
         TaskDuration = COALESCE(?, TaskDuration),
         Priority     = COALESCE(?, Priority),
         Notes        = COALESCE(?, Notes),
         Status       = COALESCE(?, Status),
         SendReminder = COALESCE(?, SendReminder)
       WHERE TaskID = ? AND UserID = ?`,
      [taskName, taskDate, taskTime, taskDuration,
       priority, notes, status, sendReminder,
       taskID, userID]
    )
    // taskhistory trigger fires automatically on status change

    res.json({ message: 'Task updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update task' })
  }
})

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', authenticate, async (req, res) => {
  const { userID } = req.user
  const taskID = parseInt(req.params.id, 10)

  try {
    const [result] = await pool.execute(
      'DELETE FROM tasks WHERE TaskID = ? AND UserID = ?',
      [taskID, userID]
    )
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Task not found' })
    }
    res.json({ message: 'Task deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete task' })
  }
})

// ════════════════════════════════════════════════════════════
//  TASK NOTES
// ════════════════════════════════════════════════════════════

// GET /api/tasks/:id/notes
app.get('/api/tasks/:id/notes', authenticate, async (req, res) => {
  const { userID } = req.user
  const taskID = parseInt(req.params.id, 10)

  try {
    // Verify task belongs to user
    const [taskRows] = await pool.execute(
      'SELECT TaskID FROM tasks WHERE TaskID = ? AND UserID = ?',
      [taskID, userID]
    )
    if (!taskRows.length) return res.status(404).json({ error: 'Task not found' })

    const [notes] = await pool.execute(
      'SELECT * FROM tasknotes WHERE TaskID = ? ORDER BY CreatedAt DESC',
      [taskID]
    )
    res.json(notes)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch notes' })
  }
})

// POST /api/tasks/:id/notes
app.post('/api/tasks/:id/notes', authenticate, async (req, res) => {
  const { userID } = req.user
  const taskID = parseInt(req.params.id, 10)
  const { noteText } = req.body

  if (!noteText) return res.status(400).json({ error: 'noteText is required' })

  try {
    const [taskRows] = await pool.execute(
      'SELECT TaskID FROM tasks WHERE TaskID = ? AND UserID = ?',
      [taskID, userID]
    )
    if (!taskRows.length) return res.status(404).json({ error: 'Task not found' })

    const [result] = await pool.execute(
      'INSERT INTO tasknotes (TaskID, UserID, NoteText) VALUES (?, ?, ?)',
      [taskID, userID, noteText]
    )
    res.status(201).json({ message: 'Note added', noteID: result.insertId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add note' })
  }
})

// ════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ════════════════════════════════════════════════════════════

// GET /api/notifications  – unread for signed-in user
app.get('/api/notifications', authenticate, async (req, res) => {
  const { userID } = req.user
  try {
    const [rows] = await pool.execute(
      `SELECT n.*, t.TaskName FROM notifications n
       JOIN tasks t ON n.TaskID = t.TaskID
       WHERE n.UserID = ? AND n.IsDismissed = 0
       ORDER BY n.AlertTime ASC`,
      [userID]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// PATCH /api/notifications/:id/read
app.patch('/api/notifications/:id/read', authenticate, async (req, res) => {
  const { userID } = req.user
  const notifID = parseInt(req.params.id, 10)
  try {
    await pool.execute(
      'UPDATE notifications SET IsRead = 1 WHERE NotificationID = ? AND UserID = ?',
      [notifID, userID]
    )
    res.json({ message: 'Notification marked as read' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update notification' })
  }
})

// PATCH /api/notifications/:id/dismiss
app.patch('/api/notifications/:id/dismiss', authenticate, async (req, res) => {
  const { userID } = req.user
  const notifID = parseInt(req.params.id, 10)
  try {
    await pool.execute(
      'UPDATE notifications SET IsDismissed = 1 WHERE NotificationID = ? AND UserID = ?',
      [notifID, userID]
    )
    res.json({ message: 'Notification dismissed' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to dismiss notification' })
  }
})

// ════════════════════════════════════════════════════════════
//  USER SETTINGS
// ════════════════════════════════════════════════════════════

// GET /api/settings
app.get('/api/settings', authenticate, async (req, res) => {
  const { userID } = req.user
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM usersettings WHERE UserID = ?',
      [userID]
    )
    res.json(rows[0] || {})
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

// PUT /api/settings
app.put('/api/settings', authenticate, async (req, res) => {
  const { userID } = req.user
  const {
    notifications, soundAlerts,
    defaultReminderMin, weekStartsOn, darkMode,
  } = req.body

  try {
    await pool.execute(
      `UPDATE usersettings SET
         Notifications      = COALESCE(?, Notifications),
         SoundAlerts        = COALESCE(?, SoundAlerts),
         DefaultReminderMin = COALESCE(?, DefaultReminderMin),
         WeekStartsOn       = COALESCE(?, WeekStartsOn),
         DarkMode           = COALESCE(?, DarkMode)
       WHERE UserID = ?`,
      [notifications, soundAlerts,
       defaultReminderMin, weekStartsOn, darkMode,
       userID]
    )
    res.json({ message: 'Settings updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

// ════════════════════════════════════════════════════════════
//  TASK HISTORY  (read-only)
// ════════════════════════════════════════════════════════════

// GET /api/tasks/:id/history
app.get('/api/tasks/:id/history', authenticate, async (req, res) => {
  const { userID } = req.user
  const taskID = parseInt(req.params.id, 10)
  try {
    const [taskRows] = await pool.execute(
      'SELECT TaskID FROM tasks WHERE TaskID = ? AND UserID = ?',
      [taskID, userID]
    )
    if (!taskRows.length) return res.status(404).json({ error: 'Task not found' })

    const [history] = await pool.execute(
      'SELECT * FROM taskhistory WHERE TaskID = ? ORDER BY ChangedAt DESC',
      [taskID]
    )
    res.json(history)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch task history' })
  }
})

// ════════════════════════════════════════════════════════════
//  STATIC FILES (optional – serve a frontend build)
// ════════════════════════════════════════════════════════════
const path    = require('path')

// ── Static files ──────────────────────────────────────────────
// Serve HTML, CSS, and JS files from the project root
app.use(express.static(path.join(__dirname)))

// app.use(express.static(path.join(__dirname, 'public')))

// ════════════════════════════════════════════════════════════
//  START  (db.js handles the connection on import)
// ════════════════════════════════════════════════════════════
app.listen(PORT, () =>
  console.log(`🚀  TasC server running → http://localhost:${PORT}`)
)

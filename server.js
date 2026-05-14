const express  = require('express');
const mysql    = require('mysql2');
const path     = require('path');
const bcrypt   = require('bcrypt');

const app         = express();
const SALT_ROUNDS = 10;
app.use(express.json());

// ── Database config ───────────────────────────────────────────
const dbConfig = {
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'task_manager',
  // Return DATE/TIME columns as plain strings, not JS Date objects.
  dateStrings: true,
};

let db;

// ── Connection with auto-reconnect ────────────────────────────
function handleDisconnect() {
  console.log('Attempting to connect to database...');
  db = mysql.createConnection(dbConfig);

  db.connect((err) => {
    if (err) {
      console.error('Error connecting to DB, retrying in 5 seconds...', err.message);
      setTimeout(handleDisconnect, 5000);
      return;
    }
    console.log('Connected to MySQL database.');
    initDatabase();
  });

  db.on('error', (err) => {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      handleDisconnect();
    } else {
      throw err;
    }
  });
}

// ── Schema setup ──────────────────────────────────────────────
function initDatabase() {

  // 1. USERS
  db.query(`
    CREATE TABLE IF NOT EXISTS users (
      UserID      INT(11)      NOT NULL AUTO_INCREMENT,
      FirstName   VARCHAR(50)  NOT NULL,
      LastName    VARCHAR(50)  NOT NULL,
      Email       VARCHAR(100) NOT NULL,
      IsLoggedIn  TINYINT(1)   NOT NULL DEFAULT 0,
      Password    VARCHAR(255) NOT NULL,
      CreatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (UserID),
      UNIQUE KEY uq_users_email (Email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `, logErr('users'));

  // 2. TASKS
  db.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      TaskID       INT(11)      NOT NULL AUTO_INCREMENT,
      UserID       INT(11)      NOT NULL,
      TaskName     VARCHAR(255) NOT NULL,
      TaskDate     DATE         NOT NULL,
      TaskTime     TIME         NOT NULL,
      TaskDuration INT(11)      NOT NULL DEFAULT 30,
      Priority     ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',
      Notes        TEXT,
      Status       ENUM('Pending','In progress','Done','Snoozed')
                   NOT NULL DEFAULT 'Pending',
      SendReminder TINYINT(1)   NOT NULL DEFAULT 1,
      TimerFinish  TIME         NOT NULL DEFAULT '00:00:00',
      TimeEnd      TIME         DEFAULT NULL,
      DateFinished DATE         DEFAULT NULL,
      CreatedAt    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (TaskID),
      KEY idx_tasks_user   (UserID),
      KEY idx_tasks_date   (TaskDate),
      KEY idx_tasks_status (Status),
      CONSTRAINT fk_tasks_user
        FOREIGN KEY (UserID) REFERENCES users (UserID)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `, (err) => {
    if (err) { console.error('Error creating tasks:', err.message); return; }
    console.log('✓ tasks ready');

    // Ensure ENUM columns are correct even if table pre-existed
    db.query(`
      ALTER TABLE tasks
        MODIFY COLUMN Status
          ENUM('Pending','In progress','Done','Snoozed')
          NOT NULL DEFAULT 'Pending',
        MODIFY COLUMN Priority
          ENUM('Low','Medium','High')
          NOT NULL DEFAULT 'Medium'
    `, (err) => {
      if (err) console.error('ALTER tasks ENUM error:', err.message);
      else     console.log('✓ tasks ENUM columns verified/updated');
    });

    // Add new timing columns if they don't exist yet (idempotent migrations)
    const migrations = [
      `ALTER TABLE tasks ADD COLUMN TimerFinish TIME NOT NULL DEFAULT '00:00:00' AFTER SendReminder`,
      `ALTER TABLE tasks ADD COLUMN TimeEnd      TIME DEFAULT NULL AFTER TimerFinish`,
      `ALTER TABLE tasks ADD COLUMN DateFinished DATE DEFAULT NULL AFTER TimeEnd`,
    ];
    migrations.forEach(sql => {
      db.query(sql, (err) => {
        // Error 1060 = column already exists — safe to ignore
        if (err && err.errno !== 1060)
          console.error('Migration error:', err.message);
        else if (!err)
          console.log('✓ migration applied:', sql.match(/ADD COLUMN (\w+)/)?.[1]);
      });
    });

    // Back-fill TimerFinish for rows that were created before this migration
    db.query(`
      UPDATE tasks
         SET TimerFinish = ADDTIME(TaskTime, SEC_TO_TIME(TaskDuration * 60)),
        '-8:00:00'
       WHERE TimerFinish = '00:00:00'
    `, (err) => {
      if (err) console.error('TimerFinish back-fill error:', err.message);
      else     console.log('✓ TimerFinish back-fill complete');
    });
  });

  // 3. TASK NOTES
  db.query(`
    CREATE TABLE IF NOT EXISTS tasknotes (
      NoteID    INT(11)  NOT NULL AUTO_INCREMENT,
      TaskID    INT(11)  NOT NULL,
      UserID    INT(11)  NOT NULL,
      NoteText  TEXT     NOT NULL,
      CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (NoteID),
      KEY idx_notes_task (TaskID),
      KEY fk_notes_user  (UserID),
      CONSTRAINT fk_notes_task
        FOREIGN KEY (TaskID) REFERENCES tasks (TaskID)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_notes_user
        FOREIGN KEY (UserID) REFERENCES users (UserID)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `, logErr('tasknotes'));

  // 4. NOTIFICATIONS
  db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      NotificationID INT(11)    NOT NULL AUTO_INCREMENT,
      TaskID         INT(11)    NOT NULL,
      UserID         INT(11)    NOT NULL,
      AlertTime      DATETIME   NOT NULL,
      SnoozedUntil   DATETIME,
      IsRead         TINYINT(1) NOT NULL DEFAULT 0,
      IsDismissed    TINYINT(1) NOT NULL DEFAULT 0,
      CreatedAt      DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (NotificationID),
      KEY idx_notif_user (UserID),
      KEY idx_notif_task (TaskID),
      CONSTRAINT fk_notif_user
        FOREIGN KEY (UserID) REFERENCES users (UserID)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_notif_task
        FOREIGN KEY (TaskID) REFERENCES tasks (TaskID)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `, logErr('notifications'));
}

// ── Small helper: log table creation errors ───────────────────
function logErr(label) {
  return (err) => {
    if (err) console.error(`Error creating ${label}:`, err.message);
    else     console.log(`✓ ${label} ready`);
  };
}

// ── Helper: compute TimerFinish string (HH:MM:SS) ─────────────
// TaskTime is 'HH:MM' or 'HH:MM:SS', duration is minutes (integer).
function computeTimerFinish(taskTime, durationMin) {
  const parts   = taskTime.split(':').map(Number);
  const hh      = parts[0] || 0;
  const mm      = parts[1] || 0;
  const ss      = parts[2] || 0;
  const totalSec = hh * 3600 + mm * 60 + ss + (durationMin * 60);
  const rh = Math.floor(totalSec / 3600) % 24;
  const rm = Math.floor((totalSec % 3600) / 60);
  const rs = totalSec % 60;
  return `${String(rh).padStart(2,'0')}:${String(rm).padStart(2,'0')}:${String(rs).padStart(2,'0')}`;
}

handleDisconnect();

// ── Static files ──────────────────────────────────────────────
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js',  express.static(path.join(__dirname, 'js')));

app.get('/',              (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html',    (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/calendar.html', (req, res) => res.sendFile(path.join(__dirname, 'calendar.html')));
app.get('/tracking.html', (req, res) => res.sendFile(path.join(__dirname, 'tracking.html')));
app.get('/login.html',    (req, res) => res.sendFile(path.join(__dirname, 'login.html')));

// ── POST /api/auth/register ───────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  if (!firstName || !lastName || !email || !password)
    return res.status(400).json({ error: 'All fields are required.' });
  try {
    db.query('SELECT UserID FROM users WHERE Email = ?', [email], async (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error.' });
      if (rows.length > 0) return res.status(409).json({ error: 'Email is already registered.' });
      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      db.query(
        `INSERT INTO users (FirstName, LastName, Email, Password, IsLoggedIn) VALUES (?, ?, ?, ?, 1)`,
        [firstName, lastName, email, hash],
        (err, result) => {
          if (err) return res.status(500).json({ error: 'Failed to create account.' });
          res.status(201).json({ userID: result.insertId, firstName });
        }
      );
    });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });
  db.query('SELECT UserID, FirstName, Password FROM users WHERE Email = ?', [email], async (err, rows) => {
    if (err)          return res.status(500).json({ error: 'Database error.' });
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password.' });
    const user  = rows[0];
    const match = await bcrypt.compare(password, user.Password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });
    db.query('UPDATE users SET IsLoggedIn = 1 WHERE UserID = ?', [user.UserID], (err) => {
      if (err) return res.status(500).json({ error: 'Login state update failed.' });
      res.json({ userID: user.UserID, firstName: user.FirstName });
    });
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────
app.post('/api/auth/logout', (req, res) => {
  const { userID } = req.body;
  if (!userID) return res.status(400).json({ error: 'userID required.' });
  db.query('UPDATE users SET IsLoggedIn = 0 WHERE UserID = ?', [userID], (err) => {
    if (err) return res.status(500).json({ error: 'Logout failed.' });
    res.json({ message: 'Logged out.' });
  });
});

// ── GET /api/tasks?userID=X ───────────────────────────────────
app.get('/api/tasks', (req, res) => {
  const { userID } = req.query;
  if (!userID) return res.status(400).json({ error: 'userID required.' });
  db.query(
    'SELECT * FROM tasks WHERE UserID = ? ORDER BY TaskDate ASC, TaskTime ASC',
    [userID],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error.' });
      res.json(rows);
    }
  );
});

// ── POST /api/tasks ───────────────────────────────────────────
app.post('/api/tasks', (req, res) => {
  const { UserID, TaskName, TaskDate, TaskTime, TaskDuration, Priority, Status, Notes, SendReminder } = req.body;
  if (!UserID || !TaskName || !TaskDate || !TaskTime)
    return res.status(400).json({ error: 'UserID, TaskName, TaskDate and TaskTime are required.' });

  const duration     = TaskDuration ?? 30;
  const timerFinish  = computeTimerFinish(TaskTime, duration);

  db.query(
    `INSERT INTO tasks
       (UserID, TaskName, TaskDate, TaskTime, TaskDuration, Priority, Status, Notes, SendReminder, TimerFinish)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      UserID, TaskName, TaskDate, TaskTime,
      duration, Priority ?? 'Medium', Status ?? 'Pending',
      Notes ?? null, SendReminder ?? 1,
      timerFinish,
    ],
    (err, result) => {
      if (err) {
        console.error('POST /api/tasks MySQL error:', err.message, '| payload:', req.body);
        return res.status(500).json({ error: 'Failed to create task: ' + err.message });
      }
      res.status(201).json({ TaskID: result.insertId });
    }
  );
});

// ── PUT /api/tasks/:id ────────────────────────────────────────
app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;

  // Fields the client is allowed to set directly
  const allowed = [
    'TaskName','TaskDate','TaskTime','TaskDuration',
    'Priority','Status','Notes','SendReminder',
    'TimeEnd','DateFinished',
  ];

  const body    = { ...req.body };
  const updates = Object.keys(body).filter(k => allowed.includes(k));
  const values  = updates.map(k => body[k]);

  if (!updates.length)
    return res.status(400).json({ error: 'No valid fields to update.' });

  // ── Auto-derive TimerFinish when TaskTime or TaskDuration changes ──
  // Fetch current row first so we always have both values available
  db.query('SELECT TaskTime, TaskDuration FROM tasks WHERE TaskID = ?', [id], (err, rows) => {
    if (err)         return res.status(500).json({ error: 'Database error.' });
    if (!rows.length) return res.status(404).json({ error: 'Task not found.' });

    const currentTime     = rows[0].TaskTime;
    const currentDuration = rows[0].TaskDuration;

    const newTime     = body.TaskTime     ?? currentTime;
    const newDuration = body.TaskDuration ?? currentDuration;

    // Recalculate TimerFinish if time/duration is being changed
    if (body.TaskTime !== undefined || body.TaskDuration !== undefined) {
      const tf = computeTimerFinish(newTime, newDuration);
      updates.push('TimerFinish');
      values.push(tf);
    }

    // ── Auto-set TimeEnd + DateFinished when marking Done ──────────
    if (body.Status === 'Done') {
      const now     = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      const dateStr = now.toISOString().slice(0, 10);

      if (!updates.includes('TimeEnd')) {
        updates.push('TimeEnd');
        values.push(timeStr);
      }
      if (!updates.includes('DateFinished')) {
        updates.push('DateFinished');
        values.push(dateStr);
      }
    }

    // ── Clear TimeEnd / DateFinished when un-completing a task ──────
    if (body.Status && body.Status !== 'Done') {
      if (!updates.includes('TimeEnd')) {
        updates.push('TimeEnd');
        values.push(null);
      }
      if (!updates.includes('DateFinished')) {
        updates.push('DateFinished');
        values.push(null);
      }
    }

    db.query(
      `UPDATE tasks SET ${updates.map(k => `${k} = ?`).join(', ')} WHERE TaskID = ?`,
      [...values, id],
      (err, result) => {
        if (err) {
          console.error('PUT /api/tasks/:id MySQL error:', err.message, '| payload:', req.body);
          return res.status(500).json({ error: 'Failed to update task: ' + err.message });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found.' });
        res.json({ message: 'Task updated.' });
      }
    );
  });
});

// ── DELETE /api/tasks/:id ─────────────────────────────────────
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM tasks WHERE TaskID = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Failed to delete task.' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found.' });
    res.json({ message: 'Task deleted.' });
  });
});

app.listen(3000, () => console.log('TasC server running on http://localhost:3000'));
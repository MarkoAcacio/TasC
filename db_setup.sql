-- ============================================================
--  TasC – Task Manager Database Setup
--  Run this in phpMyAdmin (SQL tab) or via mysql CLI:
--    mysql -u root -p < db_setup.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS task_manager
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE task_manager;

-- ────────────────────────────────────────────────────────────
--  1. USERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  UserID      INT(11)      NOT NULL AUTO_INCREMENT,
  FirstName   VARCHAR(50)  NOT NULL,
  LastName    VARCHAR(50)  NOT NULL,
  Email       VARCHAR(100) NOT NULL,
  Password    VARCHAR(255) NOT NULL,          -- bcrypt hash stored here
  CreatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (UserID),
  UNIQUE KEY uq_users_email (Email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ────────────────────────────────────────────────────────────
--  2. USER SETTINGS  (1-to-1 with users)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usersettings (
  SettingsID         INT(11)    NOT NULL AUTO_INCREMENT,
  UserID             INT(11)    NOT NULL,
  Notifications      TINYINT(1) NOT NULL DEFAULT 1,
  SoundAlerts        TINYINT(1) NOT NULL DEFAULT 1,
  DefaultReminderMin INT(11)    NOT NULL DEFAULT 15,
  WeekStartsOn       VARCHAR(10) NOT NULL DEFAULT 'Sunday',
  DarkMode           TINYINT(1) NOT NULL DEFAULT 0,
  UpdatedAt          DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (SettingsID),
  UNIQUE KEY uq_settings_user (UserID),
  CONSTRAINT fk_settings_user
    FOREIGN KEY (UserID) REFERENCES users (UserID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ────────────────────────────────────────────────────────────
--  3. TASKS  (scoped to the owning user)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  TaskID       INT(11)      NOT NULL AUTO_INCREMENT,
  UserID       INT(11)      NOT NULL,                  -- owner
  TaskName     VARCHAR(255) NOT NULL,
  TaskDate     DATE         NOT NULL,
  TaskTime     TIME         NOT NULL,
  TaskDuration INT(11)      NOT NULL DEFAULT 30,       -- minutes
  Priority     ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',
  Notes        TEXT,
  Status       ENUM('Pending','In progress','Completed','Cancelled')
               NOT NULL DEFAULT 'Pending',
  SendReminder TINYINT(1)   NOT NULL DEFAULT 1,
  CreatedAt    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (TaskID),
  KEY idx_tasks_user   (UserID),
  KEY idx_tasks_date   (TaskDate),
  KEY idx_tasks_status (Status),
  CONSTRAINT fk_tasks_user
    FOREIGN KEY (UserID) REFERENCES users (UserID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ────────────────────────────────────────────────────────────
--  4. TASK HISTORY
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taskhistory (
  HistoryID  INT(11)     NOT NULL AUTO_INCREMENT,
  TaskID     INT(11)     NOT NULL,
  OldStatus  VARCHAR(20),
  NewStatus  VARCHAR(20) NOT NULL,
  ChangedAt  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (HistoryID),
  KEY idx_history_task (TaskID),
  CONSTRAINT fk_history_task
    FOREIGN KEY (TaskID) REFERENCES tasks (TaskID)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ────────────────────────────────────────────────────────────
--  5. TASK NOTES
-- ────────────────────────────────────────────────────────────
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ────────────────────────────────────────────────────────────
--  6. NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ────────────────────────────────────────────────────────────
--  AUTO-CREATE default settings when a new user registers
-- ────────────────────────────────────────────────────────────
DELIMITER $$
CREATE TRIGGER trg_after_user_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  INSERT INTO usersettings (UserID) VALUES (NEW.UserID);
END$$
DELIMITER ;


-- ────────────────────────────────────────────────────────────
--  LOG status changes automatically
-- ────────────────────────────────────────────────────────────
DELIMITER $$
CREATE TRIGGER trg_task_status_change
AFTER UPDATE ON tasks
FOR EACH ROW
BEGIN
  IF OLD.Status <> NEW.Status THEN
    INSERT INTO taskhistory (TaskID, OldStatus, NewStatus)
    VALUES (NEW.TaskID, OLD.Status, NEW.Status);
  END IF;
END$$
DELIMITER ;
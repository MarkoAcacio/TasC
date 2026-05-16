-- ─────────────────────────────────────────────────────────────
-- TasC — task_manager schema for phpMyAdmin
-- Mirrors the CREATE TABLE statements in server.js
-- ─────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS `task_manager`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `task_manager`;

-- ── 1. USERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `UserID`     INT(11)      NOT NULL AUTO_INCREMENT,
  `FirstName`  VARCHAR(50)  NOT NULL,
  `LastName`   VARCHAR(50)  NOT NULL,
  `Email`      VARCHAR(100) NOT NULL,
  `IsLoggedIn` TINYINT(1)   NOT NULL DEFAULT 0,
  `Password`   VARCHAR(255) NOT NULL,
  `CreatedAt`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`UserID`),
  UNIQUE KEY `uq_users_email` (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. TASKS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `tasks` (
  `TaskID`       INT(11)      NOT NULL AUTO_INCREMENT,
  `UserID`       INT(11)      NOT NULL,
  `TaskName`     VARCHAR(255) NOT NULL,
  `TaskDate`     DATE         NOT NULL,
  `TaskTime`     TIME         NOT NULL,
  `TaskDuration` INT(11)      NOT NULL DEFAULT 30,
  `Priority`     ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',
  `Notes`        TEXT,
  `Status`       ENUM('Pending','In progress','Done','Snoozed')
                 NOT NULL DEFAULT 'Pending',
  `SendReminder` TINYINT(1)   NOT NULL DEFAULT 1,
  `TimerFinish`  TIME         NOT NULL DEFAULT '00:00:00',
  `TimeEnd`      TIME         DEFAULT NULL,
  `DateFinished` DATE         DEFAULT NULL,
  `CreatedAt`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`TaskID`),
  KEY `idx_tasks_user`   (`UserID`),
  KEY `idx_tasks_date`   (`TaskDate`),
  KEY `idx_tasks_status` (`Status`),
  CONSTRAINT `fk_tasks_user`
    FOREIGN KEY (`UserID`) REFERENCES `users` (`UserID`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. TASK NOTES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `tasknotes` (
  `NoteID`    INT(11)  NOT NULL AUTO_INCREMENT,
  `TaskID`    INT(11)  NOT NULL,
  `UserID`    INT(11)  NOT NULL,
  `NoteText`  TEXT     NOT NULL,
  `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`NoteID`),
  KEY `idx_notes_task` (`TaskID`),
  KEY `fk_notes_user`  (`UserID`),
  CONSTRAINT `fk_notes_task`
    FOREIGN KEY (`TaskID`) REFERENCES `tasks` (`TaskID`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_notes_user`
    FOREIGN KEY (`UserID`) REFERENCES `users` (`UserID`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. NOTIFICATIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notifications` (
  `NotificationID` INT(11)    NOT NULL AUTO_INCREMENT,
  `TaskID`         INT(11)    NOT NULL,
  `UserID`         INT(11)    NOT NULL,
  `AlertTime`      DATETIME   NOT NULL,
  `SnoozedUntil`   DATETIME,
  `IsRead`         TINYINT(1) NOT NULL DEFAULT 0,
  `IsDismissed`    TINYINT(1) NOT NULL DEFAULT 0,
  `CreatedAt`      DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`NotificationID`),
  KEY `idx_notif_user` (`UserID`),
  KEY `idx_notif_task` (`TaskID`),
  CONSTRAINT `fk_notif_user`
    FOREIGN KEY (`UserID`) REFERENCES `users` (`UserID`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_notif_task`
    FOREIGN KEY (`TaskID`) REFERENCES `tasks` (`TaskID`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

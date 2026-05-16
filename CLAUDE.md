# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TasC is a school task-manager web app. Branded "Tas·C". Three static pages (sign-in/register, calendar, tracking table) backed by an Express + MySQL server stub.

## Commands

```bash
npm install        # install express + mysql2
npm start          # runs `node server.js`
```

There are no tests, no linter, and no build step. The frontend is plain HTML/CSS/JS — open the `.html` files directly in a browser, or serve them via `server.js` once it's wired up (see "Server status" below).

DB connection requires env vars: `DB_HOST`, `DB_USER`, `DB_PASSWORD`. Database name is hardcoded to `TasC` in [server.js](server.js).

## Architecture

### Frontend ↔ SQL contract (important)

The HTML form `name=` attributes and the JS payload keys deliberately mirror SQL column names in **PascalCase** — `TaskID`, `UserID`, `TaskName`, `TaskDate`, `TaskTime`, `TaskDuration`, `Priority`, `Status`, `Notes`, `SendReminder` (Tasks table); `FirstName`, `LastName`, `Email`, `Password` (Users table). When wiring the backend, treat these as the API contract — don't rename to camelCase on either side. Console logs throughout reference "matches Users table" / "matches Tasks table" / "TaskHistory entry" as a reminder.

### Page independence

Each page has its own `js/<page>.js` with its own top-level `let tasks = [...]` array. They are not shared across pages — calendar.js and tracking.js currently keep separate stub data. When the DB is connected, each page will fetch from the same source independently; there is no shared client-side store.

### Inline event handlers

The HTML uses `onclick="..."`, `onsubmit="..."`, `oninput="..."` extensively (e.g. `onclick="openModal()"`, `onsubmit="saveTask(event)"`). The page JS files must therefore expose functions as **globals** (plain `function` declarations at the top level). Do not convert to `<script type="module">` or wrap in IIFEs — that will break every button.

### Styling

`css/styles.css` is the shared stylesheet — it defines CSS custom properties (`--cream`, `--ink`, `--amber`, `--rust`, `--sage`, `--plum`, `--line`, etc.) and imports Google Fonts (Fraunces serif + Geist sans). Each page also loads its own `css/<page>.css` for page-specific layout. The shared file must load first so the variables are defined before page styles use them.

### Server status

[server.js](server.js) is a stub. As of now it:
- Imports express + mysql2 + path
- Defines `handleDisconnect()` for resilient DB connection
- **Does not call `handleDisconnect()`** (commented out, line 45)
- **Does not call `app.listen()`** — there is no HTTP server running yet
- **Does not register `express.static(...)`** — static files aren't served
- Has no routes

When extending it: uncomment the handleDisconnect call only after the DB is set up, add `app.use(express.static(__dirname))` to serve the HTML/CSS/JS, and add `app.listen(PORT, ...)` at the bottom.

### Sample-data positioning

[js/calendar.js](js/calendar.js) hardcodes "today" to April 7, 2026 (`new Date(2026, 3, 7)`) so the seeded sample tasks line up visually. It is **not** `new Date()`. When real data replaces the stub, swap this to `new Date()`.

### Auth is cosmetic

`handleSignIn` / `handleRegister` in [js/index.js](js/index.js) only `console.log` the payload and redirect to `calendar.html`. No password check, no session — to be replaced when the backend exists.

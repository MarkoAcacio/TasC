// ============================================================
//  js/calendar.js  — Calendar page
//  All task operations hit the API; JWT from localStorage.
// ============================================================

// ── Auth guard ───────────────────────────────────────────────
const TOKEN = localStorage.getItem('tasc_token');
if (!TOKEN) window.location.href = 'index.html';

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };
}

// ── State ────────────────────────────────────────────────────
let tasks         = [];
let viewDate      = new Date();
let selectedDate  = fmtDate(new Date());
let editingTaskId = null;

const MONTHS   = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── Bootstrap ────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('/api/tasks', { headers: authHeaders() });
    if (res.status === 401) { localStorage.clear(); window.location.href = 'index.html'; return; }
    tasks = await res.json();
  } catch {
    showBanner('Could not connect to the server.', 'error');
    tasks = [];
  }
  renderCalendar();
  renderDetail();
  renderQuickStats();
}

// ── Formatters ───────────────────────────────────────────────
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtTime12(t) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${String(m).padStart(2,'0')} ${period}`;
}
function todayStr() { return fmtDate(new Date()); }

// ── Calendar grid ────────────────────────────────────────────
function renderCalendar() {
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  document.getElementById('month-label').textContent = `${MONTHS[month]} ${year}`;

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const prevDays    = new Date(year, month, 0).getDate();

  const grid = document.getElementById('days-grid');
  grid.innerHTML = '';

  for (let i = firstDay - 1; i >= 0; i--)
    grid.appendChild(makeDayCell(new Date(year, month-1, prevDays - i), true));
  for (let d = 1; d <= daysInMonth; d++)
    grid.appendChild(makeDayCell(new Date(year, month, d), false));

  const totalShown = firstDay + daysInMonth;
  const trailing   = (7 - (totalShown % 7)) % 7;
  for (let d = 1; d <= trailing; d++)
    grid.appendChild(makeDayCell(new Date(year, month+1, d), true));
}

function makeDayCell(date, otherMonth) {
  const cell = document.createElement('div');
  cell.className = 'day' + (otherMonth ? ' other-month' : '');
  const dStr = fmtDate(date);
  if (dStr === todayStr())    cell.classList.add('today');
  if (dStr === selectedDate)  cell.classList.add('selected');

  const num = document.createElement('div');
  num.className = 'day-num';
  num.textContent = date.getDate();
  cell.appendChild(num);

  const dayTasks = tasks.filter(t => t.TaskDate === dStr);
  if (dayTasks.length) {
    const dots = document.createElement('div');
    dots.className = 'day-dots';
    dayTasks.slice(0, 4).forEach(t => {
      const dot = document.createElement('div');
      dot.className = 'dot ' + t.Priority.toLowerCase();
      dots.appendChild(dot);
    });
    cell.appendChild(dots);
  }
  cell.addEventListener('click', () => {
    selectedDate = dStr;
    renderCalendar();
    renderDetail();
  });
  return cell;
}

function renderDetail() {
  const date = new Date(selectedDate + 'T00:00:00');
  document.getElementById('detail-date').textContent =
    `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()].slice(0,3)} ${date.getDate()}`;

  const dayTasks = tasks
    .filter(t => t.TaskDate === selectedDate)
    .sort((a,b) => a.TaskTime.localeCompare(b.TaskTime));

  document.getElementById('detail-count').textContent =
    dayTasks.length === 0 ? 'No tasks scheduled' :
    dayTasks.length === 1 ? '1 task scheduled'   : `${dayTasks.length} tasks scheduled`;

  const list = document.getElementById('task-list');
  if (dayTasks.length === 0) {
    list.innerHTML = '<div class="empty-day">A clear day.</div>';
    return;
  }

  list.innerHTML = dayTasks.map(t => `
    <div class="task-item" onclick="editTask(${t.TaskID})">
      <div class="task-bar ${t.Priority.toLowerCase()} ${t.Status === 'Completed' ? 'done' : ''}"></div>
      <div class="task-time">${fmtTime12(t.TaskTime)}</div>
      <div class="task-meta">
        <div class="task-name" style="${t.Status==='Completed'?'text-decoration:line-through;color:var(--muted);':''}">${t.TaskName}</div>
        <div class="task-info">
          <span class="badge badge-${t.Priority.toLowerCase()}">${t.Priority}</span>
          <span>·</span><span>${t.TaskDuration} min</span>
        </div>
      </div>
    </div>
  `).join('');
}

function renderQuickStats() {
  const now      = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd   = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const wStr = fmtDate(weekStart);
  const eStr = fmtDate(weekEnd);

  const weekTasks     = tasks.filter(t => t.TaskDate >= wStr && t.TaskDate <= eStr);
  const weekCompleted = weekTasks.filter(t => t.Status === 'Completed').length;
  const pct           = weekTasks.length
    ? Math.round(weekCompleted / weekTasks.length * 100) : 0;

  const statsEl = document.querySelector('.card .flex.between');
  if (statsEl) statsEl.querySelector('strong').textContent = `${weekTasks.length} tasks`;
  const pctEl = document.querySelector('.card .flex.between + .divider + .flex.between strong');
  if (pctEl) pctEl.textContent = `${pct}%`;
}

// ── Navigation ───────────────────────────────────────────────
function changeMonth(delta) {
  viewDate.setMonth(viewDate.getMonth() + delta);
  renderCalendar();
}
function goToday() {
  viewDate      = new Date();
  selectedDate  = fmtDate(new Date());
  renderCalendar();
  renderDetail();
}

// ── Modal ────────────────────────────────────────────────────
function openModal(task = null) {
  const form = document.getElementById('task-form');
  form.reset();
  document.getElementById('t-date').value = selectedDate;
  document.getElementById('t-time').value = '09:00';
  document.getElementById('t-duration').value = '30';

  if (task) {
    editingTaskId = task.TaskID;
    document.querySelector('.modal-header h3').textContent = 'Edit Task';
    document.getElementById('t-name').value     = task.TaskName;
    document.getElementById('t-date').value     = task.TaskDate;
    document.getElementById('t-time').value     = task.TaskTime;
    document.getElementById('t-duration').value = task.TaskDuration;
    document.getElementById('t-priority').value = task.Priority;
    document.getElementById('t-status').value   = task.Status;
    document.getElementById('t-notes').value    = task.Notes || '';
    document.getElementById('t-reminder').checked = task.SendReminder === 1;
  } else {
    editingTaskId = null;
    document.querySelector('.modal-header h3').textContent = 'New Task';
  }
  document.getElementById('task-modal').classList.add('open');
}
function closeModal() {
  document.getElementById('task-modal').classList.remove('open');
}
function editTask(id) {
  const t = tasks.find(x => x.TaskID === id);
  if (t) openModal(t);
}

// ── Save (create or update) ───────────────────────────────────
async function saveTask(e) {
  e.preventDefault();
  const fd      = new FormData(e.target);
  const payload = {
    taskName:     fd.get('TaskName'),
    taskDate:     fd.get('TaskDate'),
    taskTime:     fd.get('TaskTime'),
    taskDuration: parseInt(fd.get('TaskDuration'), 10),
    priority:     fd.get('Priority'),
    status:       fd.get('Status'),
    notes:        fd.get('Notes') || null,
    sendReminder: fd.get('SendReminder') ? 1 : 0,
  };

  const saveBtn  = e.target.querySelector('button[type="submit"]');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    let saved;
    if (editingTaskId) {
      const res = await fetch(`/api/tasks/${editingTaskId}`, {
        method:  'PUT',
        headers: authHeaders(),
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
      saved = await res.json();
      const idx = tasks.findIndex(t => t.TaskID === editingTaskId);
      if (idx !== -1) tasks[idx] = saved;
    } else {
      const res = await fetch('/api/tasks', {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Create failed');
      saved = await res.json();
      tasks.push(saved);
    }

    selectedDate = saved.TaskDate;
    viewDate     = new Date(saved.TaskDate + 'T00:00:00');
    closeModal();
    renderCalendar();
    renderDetail();
    renderQuickStats();

  } catch (err) {
    showBanner(err.message || 'Could not save task. Please try again.', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Task';
  }
}

// ── Banner ───────────────────────────────────────────────────
function showBanner(msg, type = 'info') {
  let el = document.getElementById('cal-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cal-banner';
    el.style.cssText = 'padding:.75rem 1rem;border-radius:6px;margin-bottom:1rem;font-size:.9rem;';
    document.querySelector('.container').prepend(el);
  }
  el.style.background = type === 'error' ? '#fce8e6' : '#e8f5e9';
  el.style.color      = type === 'error' ? '#c0392b' : '#276749';
  el.textContent = msg;
  setTimeout(() => el.remove(), 4000);
}

// ── Init ─────────────────────────────────────────────────────
init();

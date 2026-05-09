// ===== Sample task data (mirrors Tasks table columns) =====
let tasks = [
  { TaskID: 1, UserID: 1, TaskName: 'Team standup', TaskDate: '2026-04-07', TaskTime: '09:00', TaskDuration: 30, Priority: 'High',   Status: 'In progress', Notes: '', SendReminder: 1 },
  { TaskID: 2, UserID: 1, TaskName: 'Report due',   TaskDate: '2026-04-07', TaskTime: '14:00', TaskDuration: 60, Priority: 'Medium', Status: 'Pending',     Notes: 'Q2 financials review', SendReminder: 1 },
  { TaskID: 3, UserID: 1, TaskName: 'Gym',          TaskDate: '2026-04-07', TaskTime: '16:30', TaskDuration: 60, Priority: 'Low',    Status: 'Pending',     Notes: '', SendReminder: 0 },
  { TaskID: 4, UserID: 1, TaskName: 'Client call',  TaskDate: '2026-04-09', TaskTime: '11:00', TaskDuration: 45, Priority: 'High',   Status: 'Pending',     Notes: '', SendReminder: 1 },
  { TaskID: 5, UserID: 1, TaskName: 'Code review',  TaskDate: '2026-04-12', TaskTime: '10:00', TaskDuration: 90, Priority: 'Medium', Status: 'Pending',     Notes: '', SendReminder: 1 },
  { TaskID: 6, UserID: 1, TaskName: 'Read paper',   TaskDate: '2026-04-15', TaskTime: '20:00', TaskDuration: 60, Priority: 'Low',    Status: 'Pending',     Notes: '', SendReminder: 0 },
];

let viewDate = new Date(2026, 3, 7); // April 2026
let selectedDate = '2026-04-07';
let editingTaskId = null;

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function fmtTime12(t) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  return `${hh}:${String(m).padStart(2,'0')} ${period}`;
}

function renderCalendar() {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  document.getElementById('month-label').textContent = `${MONTHS[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const grid = document.getElementById('days-grid');
  grid.innerHTML = '';

  // Previous month tail
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = new Date(year, month-1, prevDays - i);
    grid.appendChild(makeDayCell(d, true));
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    grid.appendChild(makeDayCell(new Date(year, month, d), false));
  }
  // Next month head — fill to 6 rows
  const totalShown = firstDay + daysInMonth;
  const trailing = (7 - (totalShown % 7)) % 7;
  for (let d = 1; d <= trailing; d++) {
    grid.appendChild(makeDayCell(new Date(year, month+1, d), true));
  }
}

function makeDayCell(date, otherMonth) {
  const cell = document.createElement('div');
  cell.className = 'day' + (otherMonth ? ' other-month' : '');
  const dStr = fmtDate(date);
  if (dStr === fmtDate(new Date(2026, 3, 7))) cell.classList.add('today');
  if (dStr === selectedDate) cell.classList.add('selected');

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
    dayTasks.length === 1 ? '1 task scheduled' : `${dayTasks.length} tasks scheduled`;

  const list = document.getElementById('task-list');
  if (dayTasks.length === 0) {
    list.innerHTML = '<div class="empty-day">A clear day.</div>';
    return;
  }
  list.innerHTML = dayTasks.map(t => `
    <div class="task-item" onclick="editTask(${t.TaskID})">
      <div class="task-bar ${t.Priority.toLowerCase()} ${t.Status === 'Done' ? 'done' : ''}"></div>
      <div class="task-time">${fmtTime12(t.TaskTime)}</div>
      <div class="task-meta">
        <div class="task-name" style="${t.Status==='Done'?'text-decoration:line-through;color:var(--muted);':''}">${t.TaskName}</div>
        <div class="task-info">
          <span class="badge badge-${t.Priority.toLowerCase()}">${t.Priority}</span>
          <span>·</span><span>${t.TaskDuration} min</span>
        </div>
      </div>
    </div>
  `).join('');
}

function changeMonth(delta) {
  viewDate.setMonth(viewDate.getMonth() + delta);
  renderCalendar();
}
function goToday() {
  viewDate = new Date(2026, 3, 7);
  selectedDate = '2026-04-07';
  renderCalendar();
  renderDetail();
}

// ===== Modal =====
function openModal(task = null) {
  const form = document.getElementById('task-form');
  form.reset();
  document.getElementById('t-date').value = selectedDate;
  if (task) {
    editingTaskId = task.TaskID;
    document.querySelector('.modal-header h3').textContent = 'Edit Task';
    document.getElementById('t-name').value = task.TaskName;
    document.getElementById('t-date').value = task.TaskDate;
    document.getElementById('t-time').value = task.TaskTime;
    document.getElementById('t-duration').value = task.TaskDuration;
    document.getElementById('t-priority').value = task.Priority;
    document.getElementById('t-status').value = task.Status;
    document.getElementById('t-notes').value = task.Notes || '';
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
function saveTask(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    TaskName: fd.get('TaskName'),
    TaskDate: fd.get('TaskDate'),
    TaskTime: fd.get('TaskTime'),
    TaskDuration: parseInt(fd.get('TaskDuration'), 10),
    Priority: fd.get('Priority'),
    Status: fd.get('Status'),
    Notes: fd.get('Notes') || null,
    SendReminder: fd.get('SendReminder') ? 1 : 0,
    UserID: 1,
  };
  console.log('TASK payload (matches Tasks table):', payload);

  if (editingTaskId) {
    const idx = tasks.findIndex(t => t.TaskID === editingTaskId);
    tasks[idx] = { ...tasks[idx], ...payload };
  } else {
    const newId = Math.max(0, ...tasks.map(t => t.TaskID)) + 1;
    tasks.push({ TaskID: newId, ...payload });
  }
  selectedDate = payload.TaskDate;
  viewDate = new Date(payload.TaskDate + 'T00:00:00');
  closeModal();
  renderCalendar();
  renderDetail();
}

// Init
renderCalendar();
renderDetail();

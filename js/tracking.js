// ===== Sample data (mirrors Tasks table) =====

// TASK FORMAT
// { TaskID: 1, UserID: 1, TaskName: 'Team standup',          TaskDate: '2026-04-07', TaskTime: '09:00', TaskDuration: 30,  Priority: 'High',   Status: 'In progress', Notes: '', SendReminder: 1 }

let tasks = [
];

let sortKey = 'TaskDate';
let sortDir = 'asc';

function fmtDateLong(s) {
  const d = new Date(s + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function fmtTime12(t) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  return `${hh}:${String(m).padStart(2,'0')} ${period}`;
}

function getFiltered() {
  const search = document.getElementById('search').value.toLowerCase();
  const fStatus = document.getElementById('filter-status').value;
  const fPriority = document.getElementById('filter-priority').value;

  let list = tasks.filter(t => {
    if (search && !t.TaskName.toLowerCase().includes(search)) return false;
    if (fStatus !== 'all' && t.Status !== fStatus) return false;
    if (fPriority !== 'all' && t.Priority !== fPriority) return false;
    return true;
  });

  list.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return list;
}

function sortBy(key) {
  if (sortKey === key) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey = key;
    sortDir = 'asc';
  }
  render();
}

function renderStats() {
  const total = tasks.length;
  const done = tasks.filter(t => t.Status === 'Done').length;
  const progress = tasks.filter(t => t.Status === 'In progress').length;
  const high = tasks.filter(t => t.Priority === 'High' && t.Status !== 'Done').length;
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-done').textContent = done;
  document.getElementById('stat-progress').textContent = progress;
  document.getElementById('stat-high').textContent = high;
  document.getElementById('stat-done-pct').textContent =
    total ? `${Math.round(done/total*100)}% complete` : '0% complete';
}

function render() {
  renderStats();
  const list = getFiltered();
  const tbody = document.getElementById('task-tbody');

  // Update sort arrow indicators
  document.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('active');
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.textContent = '↕';
  });
  const active = [...document.querySelectorAll('th.sortable')].find(th =>
    th.getAttribute('onclick')?.includes(`'${sortKey}'`));
  if (active) {
    active.classList.add('active');
    active.querySelector('.sort-arrow').textContent = sortDir === 'asc' ? '↑' : '↓';
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state">
          <p>No tasks match the current filters.</p>
        </div>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(t => `
    <tr class="task-row ${t.Status === 'Done' ? 'done' : ''}">
      <td class="task-id">#${String(t.TaskID).padStart(3,'0')}</td>
      <td class="task-name-cell">${escapeHtml(t.TaskName)}</td>
      <td>${fmtDateLong(t.TaskDate)}</td>
      <td>${fmtTime12(t.TaskTime)}</td>
      <td>${t.TaskDuration} min</td>
      <td><span class="badge badge-${t.Priority.toLowerCase()}">${t.Priority}</span></td>
      <td><span class="badge badge-${statusClass(t.Status)}">${t.Status}</span></td>
      <td>${t.SendReminder ? '<span style="color:var(--sage);">●</span> On' : '<span style="color:var(--muted);">○</span> Off'}</td>
      <td>
        <div class="table-actions">
          ${t.Status !== 'Done' ? `<button class="icon-btn" onclick="markDone(${t.TaskID})" title="Mark done">✓</button>` : ''}
          <button class="icon-btn" onclick="cycleStatus(${t.TaskID})" title="Cycle status">↻</button>
          <button class="icon-btn danger" onclick="deleteTask(${t.TaskID})" title="Delete">×</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function statusClass(s) {
  return s === 'In progress' ? 'progress' :
         s === 'Done' ? 'done' :
         s === 'Snoozed' ? 'snoozed' : 'pending';
}
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function markDone(id) {
  const t = tasks.find(x => x.TaskID === id);
  if (t) {
    const oldStatus = t.Status;
    t.Status = 'Done';
    console.log('TaskHistory entry:', { TaskID: id, OldStatus: oldStatus, NewStatus: 'Done', ChangedAt: new Date().toISOString() });
    render();
  }
}
function cycleStatus(id) {
  const order = ['Pending', 'In progress', 'Done', 'Snoozed'];
  const t = tasks.find(x => x.TaskID === id);
  if (t) {
    const oldStatus = t.Status;
    const idx = order.indexOf(t.Status);
    t.Status = order[(idx + 1) % order.length];
    console.log('TaskHistory entry:', { TaskID: id, OldStatus: oldStatus, NewStatus: t.Status, ChangedAt: new Date().toISOString() });
    render();
  }
}
function deleteTask(id) {
  if (confirm('Delete this task?')) {
    tasks = tasks.filter(t => t.TaskID !== id);
    render();
  }
}
function resetFilters() {
  document.getElementById('search').value = '';
  document.getElementById('filter-status').value = 'all';
  document.getElementById('filter-priority').value = 'all';
  render();
}

render();

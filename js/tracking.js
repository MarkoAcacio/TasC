// ============================================================
//  js/tracking.js  — Tracking page
//  Fetches tasks from the API; status changes are persisted.
// ============================================================

// ── Auth guard ───────────────────────────────────────────────
const TOKEN = localStorage.getItem('tasc_token');
if (!TOKEN) window.location.href = 'index.html';

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };
}

// ── State ────────────────────────────────────────────────────
let tasks    = [];
let sortKey  = 'TaskDate';
let sortDir  = 'asc';

// ── Bootstrap ────────────────────────────────────────────────
async function init() {
  try {
    const res  = await fetch('/api/tasks', { headers: authHeaders() });
    if (res.status === 401) { localStorage.clear(); window.location.href = 'index.html'; return; }
    tasks = await res.json();
  } catch {
    showBanner('Could not connect to the server. Check your connection and refresh.', 'error');
    tasks = [];
  }
  render();
}

// ── Formatters ───────────────────────────────────────────────
function fmtDateLong(s) {
  const d = new Date(s + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function fmtTime12(t) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${String(m).padStart(2,'0')} ${period}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function statusClass(s) {
  return s === 'In progress' ? 'progress' : s === 'Completed' ? 'done' : s === 'Cancelled' ? 'snoozed' : 'pending';
}

// ── Filter + Sort ────────────────────────────────────────────
function getFiltered() {
  const search    = document.getElementById('search').value.toLowerCase();
  const fStatus   = document.getElementById('filter-status').value;
  const fPriority = document.getElementById('filter-priority').value;

  let list = tasks.filter(t => {
    if (search    && !t.TaskName.toLowerCase().includes(search)) return false;
    if (fStatus   !== 'all' && t.Status   !== fStatus)           return false;
    if (fPriority !== 'all' && t.Priority !== fPriority)         return false;
    return true;
  });

  list.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });
  return list;
}

function sortBy(key) {
  sortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
  sortKey = key;
  render();
}

// ── Stats ────────────────────────────────────────────────────
function renderStats() {
  const total    = tasks.length;
  const done     = tasks.filter(t => t.Status === 'Completed').length;
  const progress = tasks.filter(t => t.Status === 'In progress').length;
  const high     = tasks.filter(t => t.Priority === 'High' && t.Status !== 'Completed').length;
  document.getElementById('stat-total').textContent    = total;
  document.getElementById('stat-done').textContent     = done;
  document.getElementById('stat-progress').textContent = progress;
  document.getElementById('stat-high').textContent     = high;
  document.getElementById('stat-done-pct').textContent =
    total ? `${Math.round(done / total * 100)}% complete` : '0% complete';
}

// ── Render table ─────────────────────────────────────────────
function render() {
  renderStats();
  const list  = getFiltered();
  const tbody = document.getElementById('task-tbody');

  // Sort arrow indicators
  document.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('active');
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.textContent = '↕';
  });
  const active = [...document.querySelectorAll('th.sortable')]
    .find(th => th.getAttribute('onclick')?.includes(`'${sortKey}'`));
  if (active) {
    active.classList.add('active');
    active.querySelector('.sort-arrow').textContent = sortDir === 'asc' ? '↑' : '↓';
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>No tasks match the current filters.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(t => `
    <tr class="task-row ${t.Status === 'Completed' ? 'done' : ''}">
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
          ${t.Status !== 'Completed' ? `<button class="icon-btn" onclick="markDone(${t.TaskID})" title="Mark done">✓</button>` : ''}
          <button class="icon-btn" onclick="cycleStatus(${t.TaskID})" title="Cycle status">↻</button>
          <button class="icon-btn danger" onclick="deleteTask(${t.TaskID})" title="Delete">×</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── API actions ──────────────────────────────────────────────
async function patchStatus(id, status) {
  const res = await fetch(`/api/tasks/${id}`, {
    method:  'PUT',
    headers: authHeaders(),
    body:    JSON.stringify({ ...tasks.find(t => t.TaskID === id), status }),
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

async function markDone(id) {
  try {
    const updated = await patchStatus(id, 'Completed');
    const idx = tasks.findIndex(t => t.TaskID === id);
    if (idx !== -1) tasks[idx] = { ...tasks[idx], Status: updated.Status || 'Completed' };
    render();
  } catch {
    showBanner('Could not update task. Please refresh and try again.', 'error');
  }
}

async function cycleStatus(id) {
  const order = ['Pending', 'In progress', 'Completed', 'Cancelled'];
  const t     = tasks.find(x => x.TaskID === id);
  if (!t) return;
  const next  = order[(order.indexOf(t.Status) + 1) % order.length];

  try {
    const updated = await patchStatus(id, next);
    const idx = tasks.findIndex(x => x.TaskID === id);
    if (idx !== -1) tasks[idx] = { ...tasks[idx], Status: updated.Status || next };
    render();
  } catch {
    showBanner('Could not update task. Please refresh and try again.', 'error');
  }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error();
    tasks = tasks.filter(t => t.TaskID !== id);
    render();
  } catch {
    showBanner('Could not delete task. Please try again.', 'error');
  }
}

function resetFilters() {
  document.getElementById('search').value           = '';
  document.getElementById('filter-status').value   = 'all';
  document.getElementById('filter-priority').value = 'all';
  render();
}

// ── Banner ───────────────────────────────────────────────────
function showBanner(msg, type = 'info') {
  let el = document.getElementById('tracking-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tracking-banner';
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

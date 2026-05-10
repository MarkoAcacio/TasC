// ===== Load tasks from localStorage (shared with Calendar page) =====
const STORAGE_KEY = 'tasc_tasks';

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch (e) {}
}

let tasks = loadTasks();

let sortKey = 'TaskDate';
let sortDir = 'asc';

// ===== Pie chart setup =====
const PIE_COLORS = ['#e9c46a', '#57cc99', '#e63946', '#1d2233'];
const PIE_ORDER  = ['Pending', 'Completed', 'Completed late(30 mins)', 'Completed late(1-3hrs+)'];

let pieChart = null;

function scheduledEnd(t) {
  const d = new Date(t.TaskDate + 'T' + t.TaskTime + ':00');
  d.setMinutes(d.getMinutes() + t.TaskDuration);
  return d;
}

function classifyTask(t) {
  if (t.Status !== 'Done') return 'Pending';
  const completedAt = t.completedAt;
  if (!completedAt) return 'Completed';
  const diffMin = (new Date(completedAt) - scheduledEnd(t)) / 60000;
  if (diffMin <= 0)  return 'Completed';
  if (diffMin <= 30) return 'Completed late(30 mins)';
  return 'Completed late(1-3hrs+)';
}

function buildPieStats() {
  const counts = { 'Pending': 0, 'Completed': 0, 'Completed late(30 mins)': 0, 'Completed late(1-3hrs+)': 0 };
  tasks.forEach(t => counts[classifyTask(t)]++);
  return counts;
}

// Custom plugin: draw labels outside each wedge
const sliceLabelPlugin = {
  id: 'sliceLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta  = chart.getDatasetMeta(0);
    const data  = chart.data.datasets[0].data;
    const total = data.reduce((a, b) => a + b, 0);
    if (!total) return;

    meta.data.forEach((arc, i) => {
      const val = data[i];
      if (val === 0) return;
      const pct      = Math.round(val / total * 100);
      const label    = chart.data.labels[i];
      const midAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
      const r        = arc.outerRadius * 1.22;
      const x        = arc.x + Math.cos(midAngle) * r;
      const y        = arc.y + Math.sin(midAngle) * r;

      ctx.save();
      ctx.font         = '10px Geist, sans-serif';
      ctx.fillStyle    = '#2d3447';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label,     x, y - 6);
      ctx.fillText(pct + '%', x, y + 6);
      ctx.restore();
    });
  }
};

function renderPieChart() {
  const canvas = document.getElementById('trackingPieChart');
  if (!canvas) return;

  const stats  = buildPieStats();
  const values = PIE_ORDER.map(k => stats[k]);
  const total  = values.reduce((a, b) => a + b, 0);

  if (pieChart) { pieChart.destroy(); pieChart = null; }

  if (total === 0) {
    document.getElementById('pie-section').style.display = 'none';
    return;
  }
  document.getElementById('pie-section').style.display = '';

  const ctx = canvas.getContext('2d');
  pieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: PIE_ORDER,
      datasets: [{
        data: values,
        backgroundColor: PIE_COLORS,
        borderWidth: 2,
        borderColor: '#ede4d3'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: { padding: { top: 38, bottom: 38, left: 60, right: 60 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed;
              const t = values.reduce((a, b) => a + b, 0);
              return ` ${ctx.label}: ${v} (${t ? Math.round(v/t*100) : 0}%)`;
            }
          }
        }
      },
      animation: { animateScale: true, duration: 700 }
    },
    plugins: [sliceLabelPlugin]
  });

  // Legend dots
  const legendEl = document.getElementById('pie-legend');
  legendEl.innerHTML = PIE_ORDER.map((label, i) => {
    const count = values[i];
    const pct   = total ? Math.round(count / total * 100) : 0;
    return `
      <div class="pie-legend-item">
        <span class="pie-legend-dot" style="background:${PIE_COLORS[i]}"></span>
        <span class="pie-legend-label">${label}</span>
        <span class="pie-legend-pct">${count}&nbsp;·&nbsp;${pct}%</span>
      </div>`;
  }).join('');
}

// ===== Formatting helpers =====
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
  const search    = document.getElementById('search').value.toLowerCase();
  const fStatus   = document.getElementById('filter-status').value;
  const fPriority = document.getElementById('filter-priority').value;

  let list = tasks.filter(t => {
    if (search && !t.TaskName.toLowerCase().includes(search)) return false;
    if (fStatus   !== 'all' && t.Status   !== fStatus)   return false;
    if (fPriority !== 'all' && t.Priority !== fPriority) return false;
    return true;
  });

  list.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1  : -1;
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
  const total    = tasks.length;
  const done     = tasks.filter(t => t.Status === 'Done').length;
  const progress = tasks.filter(t => t.Status === 'In progress').length;
  const high     = tasks.filter(t => t.Priority === 'High' && t.Status !== 'Done').length;
  document.getElementById('stat-total').textContent    = total;
  document.getElementById('stat-done').textContent     = done;
  document.getElementById('stat-progress').textContent = progress;
  document.getElementById('stat-high').textContent     = high;
  document.getElementById('stat-done-pct').textContent =
    total ? `${Math.round(done/total*100)}% complete` : '0% complete';
}

function render() {
  renderStats();
  renderPieChart();

  const list  = getFiltered();
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
      <td>${t.SendReminder ? '<span style="color:var(--sage);">&#9679;</span> On' : '<span style="color:var(--muted);">&#9675;</span> Off'}</td>
      <td>
        <div class="table-actions">
          ${t.Status !== 'Done' ? `<button class="icon-btn" onclick="markDone(${t.TaskID})" title="Mark done">&#10003;</button>` : ''}
          <button class="icon-btn" onclick="cycleStatus(${t.TaskID})" title="Cycle status">&#8635;</button>
          <button class="icon-btn danger" onclick="deleteTask(${t.TaskID})" title="Delete">&times;</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function statusClass(s) {
  return s === 'In progress' ? 'progress' :
         s === 'Done'        ? 'done'     :
         s === 'Snoozed'     ? 'snoozed'  : 'pending';
}
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function markDone(id) {
  const t = tasks.find(x => x.TaskID === id);
  if (t) {
    t.Status      = 'Done';
    t.completedAt = new Date().toISOString();
    saveTasks();
    render();
  }
}
function cycleStatus(id) {
  const order = ['Pending', 'In progress', 'Done', 'Snoozed'];
  const t = tasks.find(x => x.TaskID === id);
  if (t) {
    const idx  = order.indexOf(t.Status);
    t.Status   = order[(idx + 1) % order.length];
    if (t.Status === 'Done') t.completedAt = new Date().toISOString();
    saveTasks();
    render();
  }
}
function deleteTask(id) {
  if (confirm('Delete this task?')) {
    tasks = tasks.filter(t => t.TaskID !== id);
    saveTasks();
    render();
  }
}
function resetFilters() {
  document.getElementById('search').value           = '';
  document.getElementById('filter-status').value   = 'all';
  document.getElementById('filter-priority').value = 'all';
  render();
}

render();

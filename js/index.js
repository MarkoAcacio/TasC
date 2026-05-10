// ============================================================
//  js/index.js  —  Sample Dashboard (static data, no backend)
// ============================================================

// ── Sample task data ──────────────────────────────────────────
const dashTasks = [
  { TaskID:  1, TaskName: 'Morning standup',  TaskDate: '2026-05-10', TaskTime: '09:00', TaskDuration: 30,  Status: 'Done',    completedAt: '2026-05-10T09:28:00' },
  { TaskID:  2, TaskName: 'Review PR #42',    TaskDate: '2026-05-10', TaskTime: '10:00', TaskDuration: 45,  Status: 'Done',    completedAt: '2026-05-10T11:15:00' },
  { TaskID:  3, TaskName: 'Write tests',      TaskDate: '2026-05-10', TaskTime: '11:30', TaskDuration: 60,  Status: 'Pending', completedAt: null },
  { TaskID:  4, TaskName: 'Report due',       TaskDate: '2026-05-10', TaskTime: '14:00', TaskDuration: 20,  Status: 'Pending', completedAt: null },
  { TaskID:  5, TaskName: 'Deploy hotfix',    TaskDate: '2026-05-09', TaskTime: '16:00', TaskDuration: 90,  Status: 'Done',    completedAt: '2026-05-09T17:45:00' },
  { TaskID:  6, TaskName: 'Weekly report',    TaskDate: '2026-05-08', TaskTime: '15:00', TaskDuration: 40,  Status: 'Done',    completedAt: '2026-05-08T16:10:00' },
  { TaskID:  7, TaskName: 'DB backup check',  TaskDate: '2026-05-07', TaskTime: '09:30', TaskDuration: 20,  Status: 'Done',    completedAt: '2026-05-07T10:05:00' },
  { TaskID:  8, TaskName: 'Plan sprint',      TaskDate: '2026-05-11', TaskTime: '10:00', TaskDuration: 60,  Status: 'Pending', completedAt: null },
  { TaskID:  9, TaskName: 'Code review docs', TaskDate: '2026-05-11', TaskTime: '14:00', TaskDuration: 30,  Status: 'Pending', completedAt: null },
  { TaskID: 10, TaskName: 'Update README',    TaskDate: '2026-05-09', TaskTime: '11:00', TaskDuration: 25,  Status: 'Done',    completedAt: '2026-05-09T13:20:00' },
  { TaskID: 11, TaskName: 'Fix login bug',    TaskDate: '2026-05-08', TaskTime: '10:00', TaskDuration: 45,  Status: 'Done',    completedAt: '2026-05-08T11:55:00', },
]

// ── Helpers ───────────────────────────────────────────────────
function scheduledEnd (t) {
  const d = new Date(`${t.TaskDate}T${t.TaskTime}`)
  d.setMinutes(d.getMinutes() + t.TaskDuration)
  return d
}

function classifyTask (t) {
  if (t.Status !== 'Done') return 'Pending'
  const diffMin = (new Date(t.completedAt) - scheduledEnd(t)) / 60000
  if (diffMin <= 0)  return 'Completed'
  if (diffMin <= 30) return 'Completed late(30 mins)'
  return 'Completed late(1-3hrs+)'
}

function buildStats () {
  const counts = { 'Pending': 0, 'Completed': 0, 'Completed late(30 mins)': 0, 'Completed late(1-3hrs+)': 0 }
  dashTasks.forEach(t => { const k = classifyTask(t); if (counts[k] !== undefined) counts[k]++ })
  return counts
}

// ── Pie chart ─────────────────────────────────────────────────
const PIE_COLORS = ['#e9c46a', '#57cc99', '#e63946', '#1d2233']
const PIE_ORDER  = ['Pending', 'Completed', 'Completed late(30 mins)', 'Completed late(1-3hrs+)']

const sliceLabelPlugin = {
  id: 'sliceLabels',
  afterDatasetsDraw (chart) {
    const { ctx } = chart
    const meta    = chart.getDatasetMeta(0)
    const data    = chart.data.datasets[0].data
    const total   = data.reduce((a, b) => a + b, 0)
    if (!total) return
    meta.data.forEach((arc, i) => {
      const val = data[i]
      if (val === 0) return
      const pct      = Math.round(val / total * 100)
      const midAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2
      const r        = arc.outerRadius * 1.22
      const x        = arc.x + Math.cos(midAngle) * r
      const y        = arc.y + Math.sin(midAngle) * r
      ctx.save()
      ctx.font         = '10px Geist, sans-serif'
      ctx.fillStyle    = '#2d3447'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(chart.data.labels[i], x, y - 6)
      ctx.fillText(pct + '%', x, y + 6)
      ctx.restore()
    })
  }
}

const stats  = buildStats()
const values = PIE_ORDER.map(k => stats[k])
const ctx    = document.getElementById('taskPieChart').getContext('2d')

new Chart(ctx, {
  type: 'pie',
  data: {
    labels: PIE_ORDER,
    datasets: [{
      data:            values,
      backgroundColor: PIE_COLORS,
      borderWidth:     0.5,
      borderColor:     '#ede4d3'
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: true,
    layout: { padding: { top: 35, bottom: 35, left: 56, right: 56 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: c => {
            const v = c.parsed
            const t = values.reduce((a, b) => a + b, 0)
            return ` ${c.label}: ${v} (${t ? Math.round(v / t * 100) : 0}%)`
          }
        }
      }
    },
    animation: { animateScale: true, duration: 700 }
  },
  plugins: [sliceLabelPlugin]
})

// ── Notification bell toggle ──────────────────────────────────
function toggleNotifDropdown () {
  document.getElementById('notif-dropdown').classList.toggle('open')
}

document.addEventListener('click', e => {
  const wrap = document.querySelector('.notif-wrap')
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('notif-dropdown')?.classList.remove('open')
  }
})

/* USE AFTER DATABASE IS FIXED
// ============================================================
// Auth tab switching
// ============================================================
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`[data-form="${btn.dataset.tab}"]`).classList.add('active');
  });
});

// ============================================================
// Sample tasks — replace with real API fetch once backend is wired
// ============================================================
const dashTasks = [
  { TaskID:  1, TaskName: 'Morning standup',  TaskDate: '2026-05-10', TaskTime: '09:00', TaskDuration: 30,  Status: 'Done',    completedAt: '2026-05-10T09:28:00' },
  { TaskID:  2, TaskName: 'Review PR #42',    TaskDate: '2026-05-10', TaskTime: '10:00', TaskDuration: 45,  Status: 'Done',    completedAt: '2026-05-10T11:15:00' },
  { TaskID:  3, TaskName: 'Write tests',      TaskDate: '2026-05-10', TaskTime: '11:30', TaskDuration: 60,  Status: 'Pending', completedAt: null },
  { TaskID:  4, TaskName: 'Client email',     TaskDate: '2026-05-10', TaskTime: '13:00', TaskDuration: 20,  Status: 'Pending', completedAt: null },
  { TaskID:  5, TaskName: 'Deploy hotfix',    TaskDate: '2026-05-09', TaskTime: '16:00', TaskDuration: 90,  Status: 'Done',    completedAt: '2026-05-09T17:45:00' },
  { TaskID:  6, TaskName: 'Weekly report',    TaskDate: '2026-05-08', TaskTime: '15:00', TaskDuration: 40,  Status: 'Done',    completedAt: '2026-05-08T16:10:00' },
  { TaskID:  7, TaskName: 'DB backup check',  TaskDate: '2026-05-07', TaskTime: '09:30', TaskDuration: 20,  Status: 'Done',    completedAt: '2026-05-07T10:05:00' },
  { TaskID:  8, TaskName: 'Plan sprint',      TaskDate: '2026-05-11', TaskTime: '10:00', TaskDuration: 60,  Status: 'Pending', completedAt: null },
  { TaskID:  9, TaskName: 'Code review docs', TaskDate: '2026-05-11', TaskTime: '14:00', TaskDuration: 30,  Status: 'Pending', completedAt: null },
  { TaskID: 10, TaskName: 'Update README',    TaskDate: '2026-05-09', TaskTime: '11:00', TaskDuration: 25,  Status: 'Done',    completedAt: '2026-05-09T13:20:00' },
  { TaskID: 11, TaskName: 'Fix login bug',    TaskDate: '2026-05-08', TaskTime: '10:00', TaskDuration: 45,  Status: 'Pending', completedAt: null },
];

// ---- Helpers -------------------------------------------------------
function scheduledEnd(t) {
  const d = new Date(t.TaskDate + 'T' + t.TaskTime + ':00');
  d.setMinutes(d.getMinutes() + t.TaskDuration);
  return d;
}

function classifyTask(t) {
  if (t.Status !== 'Done') return 'Pending';
  const diffMin = (new Date(t.completedAt) - scheduledEnd(t)) / 60000;
  if (diffMin <= 0)  return 'Completed';
  if (diffMin <= 30) return 'Completed late(30 mins)';
  return 'Completed late(1-3hrs+)';
}

function buildStats() {
  const counts = { 'Pending': 0, 'Completed': 0, 'Completed late(30 mins)': 0, 'Completed late(1-3hrs+)': 0 };
  dashTasks.forEach(t => counts[classifyTask(t)]++);
  return counts;
}

function getUrgentTask() {
  const now = new Date();
  let urgent = null, minLeft = Infinity;
  dashTasks.filter(t => t.Status === 'Pending').forEach(t => {
    const diff = (scheduledEnd(t) - now) / 60000;
    if (diff > 0 && diff < minLeft) { minLeft = diff; urgent = t; }
  });
  return urgent ? { task: urgent, mins: Math.round(minLeft) } : null;
}

function getNextUpcoming() {
  const now = new Date();
  let next = null, minDiff = Infinity;
  dashTasks.filter(t => t.Status === 'Pending').forEach(t => {
    const diff = new Date(t.TaskDate + 'T' + t.TaskTime + ':00') - now;
    if (diff > 0 && diff < minDiff) { minDiff = diff; next = t; }
  });
  return next;
}

function fmtDateTime(t) {
  const d = new Date(t.TaskDate + 'T' + t.TaskTime + ':00');
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const h = d.getHours(), m = d.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${mo[d.getMonth()]} ${d.getDate()} at ${hh}:${String(m).padStart(2,'0')} ${period}`;
}

// ---- Chart colours: yellow, green, red, dark navy ----------------
const PIE_COLORS = ['#e9c46a', '#57cc99', '#e63946', '#1d2233'];
const PIE_ORDER  = ['Pending', 'Completed', 'Completed late(30 mins)', 'Completed late(1-3hrs+)'];

let pieChart = null;

// ---- Custom plugin: slice labels drawn outside each wedge --------
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
      ctx.fillText(label,       x, y - 6);
      ctx.fillText(pct + '%',   x, y + 6);
      ctx.restore();
    });
  }
};

// ---- Render the dashboard ----------------------------------------
function renderDashboard(userName) {
  const stats  = buildStats();
  const total  = dashTasks.length;
  const done   = dashTasks.filter(t => t.Status === 'Done').length;
  const weekPct = total ? Math.round(done / total * 100) : 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = dashTasks.filter(t => t.TaskDate === todayStr).length;

  // Update hero stats
  document.getElementById('stat-today').textContent  = String(todayCount).padStart(2, '0');
  document.getElementById('stat-week').textContent   = weekPct + '%';
  document.getElementById('stat-streak').textContent = done;

  // Greeting
  if (userName) {
    document.getElementById('dash-greeting').textContent = 'Welcome back, ' + userName;
  }

  // Pie chart
  if (pieChart) { pieChart.destroy(); pieChart = null; }
  const ctx = document.getElementById('taskPieChart').getContext('2d');
  const values = PIE_ORDER.map(k => stats[k]);

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
      layout: { padding: { top: 44, bottom: 44, left: 56, right: 56 } },
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

  // Info rows
  const pending = stats['Pending'];
  document.getElementById('info-pending').innerHTML = `Pending tasks: <strong>${pending}</strong>`;

  const urgent = getUrgentTask();
  const urgentEl = document.getElementById('info-urgent');
  if (urgent) {
    urgentEl.textContent = `URGENT TASK (${urgent.task.TaskName}): ${urgent.mins} mins remaining`;
    urgentEl.style.display = '';
  } else {
    urgentEl.style.display = 'none';
  }

  const upcoming = getNextUpcoming();
  const upcomingEl = document.getElementById('info-upcoming');
  if (upcoming) {
    upcomingEl.textContent = `Upcoming task: ${upcoming.TaskName} (${fmtDateTime(upcoming)})`;
    upcomingEl.style.display = '';
  } else {
    upcomingEl.style.display = 'none';
  }
}

// ---- Panel switching ---------------------------------------------
function showDashboard(userName) {
  document.getElementById('auth-panel').style.display    = 'none';
  const dash = document.getElementById('dashboard-panel');
  dash.style.display = 'block';
  renderDashboard(userName);
}

function showAuth() {
  if (pieChart) { pieChart.destroy(); pieChart = null; }
  document.getElementById('dashboard-panel').style.display = 'none';
  document.getElementById('auth-panel').style.display      = 'block';
}

// ---- Form handlers -----------------------------------------------
function handleSignIn(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  console.log('SIGN IN payload (matches Users table):', data);
  // TODO: POST /api/auth/signin → on success call showDashboard()
  showDashboard(data.Email.split('@')[0]);
}

function handleRegister(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  console.log('REGISTER payload (matches Users table):', data);
  // TODO: POST /api/auth/register → on success call showDashboard()
  showDashboard(data.FirstName);
}

function handleSignOut() {
  showAuth();
} 
*/

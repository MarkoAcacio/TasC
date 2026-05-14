// ============================================================
//  js/index.js  —  Dashboard
//  Requires a valid session (tasc_userID in sessionStorage)
// ============================================================

const API = '/api'   // relative — works on any host/port

// ── Auth guard ────────────────────────────────────────────────
const SESSION_USERID    = sessionStorage.getItem('tasc_userID')
const SESSION_FIRSTNAME = sessionStorage.getItem('tasc_firstName') || 'Tasker'

if (!SESSION_USERID) {
  window.location.href = 'login.html'
}

// ── Task classification (5 buckets) ──────────────────────────
// Uses DB-stored TimerFinish, TimeEnd, DateFinished for accuracy.
//
// Rules:
//  • Not Done                          → 'Pending'
//  • Done, no TimeEnd stored           → 'Completed'          (legacy / immediate)
//  • DateFinished > TaskDate (+1 day)  → 'Too late'
//  • TimeEnd > TimerFinish by >3 hrs   → 'Too late'
//  • TimeEnd > TimerFinish by 1–3 hrs  → 'Completed late(1-3hrs+)'
//  • TimeEnd > TimerFinish by 1–30 min → 'Completed late(30 mins)'
//  • Otherwise                         → 'Completed'
function classifyTask (t) {


  if (t.Status !== 'Done') return 'Pending'

  // No completion timestamp recorded → treat as on-time
  if (!t.TimeEnd || !t.DateFinished) return 'Completed'

  // DateFinished is a day later than TaskDate → always "Too late"
  if (t.DateFinished > t.TaskDate) return 'Too late'
  // Both times are 'HH:MM:SS' strings from MySQL (dateStrings:true)
  const diffMin = (timeToMinutes(t.TimeEnd) + 460) - timeToMinutes(t.TimerFinish)
  
if (diffMin > 180) {
  return 'Too late'
} else if (diffMin > 30) {
  return 'Completed late(1-3hrs+)'
} else if (diffMin > 0) {
  return 'Completed late(30 mins)'
} else {
  return 'Completed'
}// on time or early
}

// Convert 'HH:MM:SS' (or 'HH:MM') to total minutes
function timeToMinutes (timeStr) {
  if (!timeStr) return 0
  const parts = timeStr.split(':').map(Number)
  return (parts[0] || 0) * 60 + (parts[1] || 0)   
}

function buildStats (tasks) {
  const counts = {
    'Pending': 0,
    'Completed': 0,
    'Completed late(30 mins)': 0,
    'Completed late(1-3hrs+)': 0,
    'Too late': 0,
  }
  tasks.forEach(t => { const k = classifyTask(t); if (counts[k] !== undefined) counts[k]++ })
  return counts
}

// ── Helpers ───────────────────────────────────────────────────
function scheduledEnd (t) {
  const d = new Date(`${t.TaskDate}T${t.TaskTime}`)
  d.setMinutes(d.getMinutes() + t.TaskDuration)
  return d
}

function getUrgentTask (tasks) {
  const now = new Date()
  let urgent = null, minLeft = Infinity
  tasks.filter(t => t.Status === 'Pending' || t.Status === 'In progress').forEach(t => {
    const diff = (scheduledEnd(t) - now) / 60000
    if (diff > 0 && diff < minLeft) { minLeft = diff; urgent = t }
  })
  return urgent ? { task: urgent, mins: Math.round(minLeft) } : null
}

// ── Pie chart ─────────────────────────────────────────────────
// 5 slices: Pending · Completed · Late(30m) · Late(1-3h) · Too late
const PIE_COLORS = ['#e9c46a', '#57cc99', '#f4a261', '#e63946', '#1d2233']
const PIE_ORDER  = ['Pending', 'Completed', 'Completed late(30 mins)', 'Completed late(1-3hrs+)', 'Too late']
let   pieChart   = null

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

// ── Render dashboard with real task data ──────────────────────
function renderDashboard (tasks) {
  const stats      = buildStats(tasks)
  const total      = tasks.length
  const done       = tasks.filter(t => t.Status === 'Done').length
  const pending    = tasks.filter(t => t.Status !== 'Done').length
  const highCount  = tasks.filter(t => t.Priority === 'High' && t.Status !== 'Done').length
  const weekPct    = total ? Math.round(done / total * 100) : 0
  const todayStr   = new Date().toISOString().slice(0, 10)
  const todayCount = tasks.filter(t => t.TaskDate === todayStr).length

  // Hero stats
  document.querySelector('.hero-stats .stat:nth-child(1) strong').textContent =
    String(todayCount).padStart(2, '0')
  document.querySelector('.hero-stats .stat:nth-child(2) strong').textContent =
    weekPct + '%'
  document.querySelector('.hero-stats .stat:nth-child(3) strong').textContent =
    done

  // Greeting
  const greetEl = document.querySelector('.dash-topbar .eyebrow')
  if (greetEl) greetEl.textContent = `Welcome back, ${SESSION_FIRSTNAME}`

  // Pie chart
  if (pieChart) { pieChart.destroy(); pieChart = null }
  const canvas = document.getElementById('taskPieChart')
  if (canvas) {
    const values = PIE_ORDER.map(k => stats[k])
    pieChart = new Chart(canvas.getContext('2d'), {
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
        responsive:          true,
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
  }

  // ── Info lines ────────────────────────────────────────────────
  const infoLines = document.querySelectorAll('.dashboard-info .info-line')

  if (infoLines[0])
    infoLines[0].innerHTML = `Pending tasks: <strong>${pending}</strong>`

  const urgent = getUrgentTask(tasks)
  if (infoLines[1]) {
    if (urgent) {
      infoLines[1].textContent   = `URGENT TASK (${urgent.task.TaskName}): ${urgent.mins} mins remaining`
      infoLines[1].style.display = ''
    } else {
      infoLines[1].style.display = 'none'
    }
  }

  if (infoLines[2])
    infoLines[2].innerHTML = `High priority tasks: <strong>${highCount}</strong>`
}

// ── Sign out ──────────────────────────────────────────────────
async function signOut () {
  try {
    await fetch(`${API}/auth/logout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userID: SESSION_USERID }),
    })
  } catch { /* best-effort */ }
  sessionStorage.clear()
  window.location.href = 'login.html'
}

const signOutBtn = document.querySelector('.dash-topbar .btn-ghost')
if (signOutBtn) signOutBtn.addEventListener('click', signOut)

// ── Notification bell ─────────────────────────────────────────
let _dashTasks = []

function toggleNotifDropdown () {
  const dd = document.getElementById('notif-dropdown')
  dd.classList.toggle('open')
  if (dd.classList.contains('open')) renderNotifItems(getNotifTasks(_dashTasks))
}

document.addEventListener('click', e => {
  const wrap = document.querySelector('.notif-wrap')
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('notif-dropdown')?.classList.remove('open')
  }
})

function scheduledEnd_dash (t) {
  const d = new Date(`${t.TaskDate}T${t.TaskTime}`)
  d.setMinutes(d.getMinutes() + t.TaskDuration)
  return d
}

function getNotifTasks (taskList) {
  const now   = new Date()
  const items = []
  taskList.forEach(t => {
    if (t.Status === 'Done' || t.Status === 'Snoozed') return
    const startTime   = new Date(`${t.TaskDate}T${t.TaskTime}`)
    const endTime     = scheduledEnd_dash(t)
    const minsToStart = (startTime - now) / 60000
    const minsLeft    = (endTime - now) / 60000

    if (minsToStart >= 0 && minsToStart <= 5)
      items.push({ task: t, type: 'starting', minsToStart: Math.round(minsToStart) })
    else if (minsToStart < 0 && minsLeft > 0 && minsLeft <= 30)
      items.push({ task: t, type: 'timer', minsLeft: Math.round(minsLeft) })
    else if (minsLeft < 0)
      items.push({ task: t, type: 'overdue', minsOver: Math.round(-minsLeft) })
  })
  const order = { overdue: 0, timer: 1, starting: 2 }
  items.sort((a, b) => order[a.type] - order[b.type])
  return items
}

const PRIORITY_HIGHLIGHT = { High: 'rgba(139,58,31,0.10)', Medium: 'rgba(201,116,42,0.10)', Low: 'rgba(107,125,90,0.10)' }
const PRIORITY_BORDER    = { High: 'var(--rust)', Medium: 'var(--amber)', Low: 'var(--sage)' }

function fmtTime12_notif (t) {
  const [h, m] = t.split(':').map(Number)
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hh}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function renderNotifItems (items) {
  const list = document.getElementById('notif-list')
  const dot  = document.getElementById('notif-dot')
  if (!items.length) {
    list.innerHTML = '<p class="notif-empty">No urgent tasks right now.</p>'
    if (dot) dot.style.display = 'none'
    return
  }
  if (dot) dot.style.display = 'block'
  list.innerHTML = items.map(({ task, type, minsToStart, minsLeft, minsOver }) => {
    const bg     = PRIORITY_HIGHLIGHT[task.Priority] || 'transparent'
    const border = PRIORITY_BORDER[task.Priority]    || 'var(--line)'
    let tagClass, tagLabel, subText
    if (type === 'starting') {
      tagClass = 'urgent'; tagLabel = '⚡ Starting soon'
      subText  = minsToStart === 0 ? 'Starting now' : `In ${minsToStart} min`
    } else if (type === 'timer') {
      tagClass = task.Priority === 'High' ? 'urgent' : 'high'
      tagLabel = '⏱ Timer ending'
      subText  = `${minsLeft} min left on timer`
    } else {
      tagClass = 'urgent'; tagLabel = '🔴 Overdue'
      subText  = `${minsOver} min past end time`
    }
    return `
      <div class="notif-item" style="background:${bg};border-left:3px solid ${border};padding-left:1rem;cursor:pointer;" onclick="window.location.href='calendar.html'">
        <div class="notif-item-tag ${tagClass}">${tagLabel}</div>
        <div class="notif-item-title">${task.TaskName}</div>
        <div class="notif-item-sub">${subText} · ${fmtTime12_notif(task.TaskTime)} · ${task.Priority} priority</div>
      </div>`
  }).join('')
}

setInterval(() => {
  const items = getNotifTasks(_dashTasks)
  const dot   = document.getElementById('notif-dot')
  if (dot) dot.style.display = items.length ? 'block' : 'none'
  const dd = document.getElementById('notif-dropdown')
  if (dd && dd.classList.contains('open')) renderNotifItems(items)
}, 60000)

// ── Init ──────────────────────────────────────────────────────
async function loadDashboard () {
  try {
    const res = await fetch(`${API}/tasks?userID=${SESSION_USERID}`)
    if (!res.ok) throw new Error('Failed to load tasks')
    const tasks = await res.json()
    _dashTasks = tasks
    renderDashboard(tasks)
    const items = getNotifTasks(tasks)
    const dot   = document.getElementById('notif-dot')
    if (dot) dot.style.display = items.length ? 'block' : 'none'
  } catch (err) {
    console.error('Dashboard load error:', err.message)
    renderDashboard([])
  }
}
loadDashboard()
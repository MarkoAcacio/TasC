// ============================================================
//  js/tracking.js  —  Sample Tracking (static data, no backend)
// ============================================================

// ── Static sample tasks ───────────────────────────────────────
let tasks = [
  { TaskID: 1,  TaskName: 'Morning standup',  TaskDate: '2026-05-10', TaskTime: '09:00', TaskDuration: 30,  Priority: 'High',   Status: 'Done',        SendReminder: 1, completedAt: '2026-05-10T09:28:00' },
  { TaskID: 2,  TaskName: 'Review PR #42',    TaskDate: '2026-05-10', TaskTime: '10:00', TaskDuration: 45,  Priority: 'Medium', Status: 'Done',        SendReminder: 1, completedAt: '2026-05-10T11:15:00' },
  { TaskID: 3,  TaskName: 'Write tests',      TaskDate: '2026-05-10', TaskTime: '11:30', TaskDuration: 60,  Priority: 'Medium', Status: 'In progress', SendReminder: 1, completedAt: null },
  { TaskID: 4,  TaskName: 'Report due',       TaskDate: '2026-05-10', TaskTime: '14:00', TaskDuration: 20,  Priority: 'High',   Status: 'Pending',     SendReminder: 1, completedAt: null },
  { TaskID: 5,  TaskName: 'Deploy hotfix',    TaskDate: '2026-05-09', TaskTime: '16:00', TaskDuration: 90,  Priority: 'High',   Status: 'Done',        SendReminder: 0, completedAt: '2026-05-09T17:45:00' },
  { TaskID: 6,  TaskName: 'Weekly report',    TaskDate: '2026-05-08', TaskTime: '15:00', TaskDuration: 40,  Priority: 'Medium', Status: 'Done',        SendReminder: 1, completedAt: '2026-05-08T16:55:00' },
  { TaskID: 7,  TaskName: 'DB backup check',  TaskDate: '2026-05-07', TaskTime: '09:30', TaskDuration: 20,  Priority: 'Low',    Status: 'Done',        SendReminder: 0, completedAt: '2026-05-07T10:05:00' },
  { TaskID: 8,  TaskName: 'Plan sprint',      TaskDate: '2026-05-11', TaskTime: '10:00', TaskDuration: 60,  Priority: 'High',   Status: 'Pending',     SendReminder: 1, completedAt: null },
  { TaskID: 9,  TaskName: 'Code review docs', TaskDate: '2026-05-11', TaskTime: '14:00', TaskDuration: 30,  Priority: 'Low',    Status: 'Pending',     SendReminder: 0, completedAt: null },
  { TaskID: 10, TaskName: 'Update README',    TaskDate: '2026-05-09', TaskTime: '11:00', TaskDuration: 25,  Priority: 'Low',    Status: 'Done',        SendReminder: 0, completedAt: '2026-05-09T13:20:00' },
  { TaskID: 11, TaskName: 'Fix login bug',    TaskDate: '2026-05-08', TaskTime: '10:00', TaskDuration: 45,  Priority: 'High',   Status: 'Snoozed',     SendReminder: 1, completedAt: null },
]

let sortKey = 'TaskDate'
let sortDir = 'asc'

// ── Pie chart setup ───────────────────────────────────────────
const PIE_COLORS = ['#e9c46a', '#57cc99', '#e63946', '#1d2233']
const PIE_ORDER  = ['Pending', 'Completed', 'Completed late(30 mins)', 'Completed late(1-3hrs+)']

let pieChart = null

function scheduledEnd (t) {
  const d = new Date(`${t.TaskDate}T${t.TaskTime}:00`)
  d.setMinutes(d.getMinutes() + t.TaskDuration)
  return d
}

function classifyTask (t) {
  if (t.Status !== 'Done') return 'Pending'
  if (!t.completedAt) return 'Completed'
  const diffMin = (new Date(t.completedAt) - scheduledEnd(t)) / 60000
  if (diffMin <= 0)  return 'Completed'
  if (diffMin <= 30) return 'Completed late(30 mins)'
  return 'Completed late(1-3hrs+)'
}

function buildPieStats () {
  const counts = { 'Pending': 0, 'Completed': 0, 'Completed late(30 mins)': 0, 'Completed late(1-3hrs+)': 0 }
  tasks.forEach(t => { const k = classifyTask(t); if (counts[k] !== undefined) counts[k]++ })
  return counts
}

// Custom slice label plugin
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

function renderPieChart () {
  const canvas = document.getElementById('trackingPieChart')
  if (!canvas) return

  const stats  = buildPieStats()
  const values = PIE_ORDER.map(k => stats[k])
  const total  = values.reduce((a, b) => a + b, 0)

  if (pieChart) { pieChart.destroy(); pieChart = null }

  if (total === 0) {
    document.getElementById('pie-section').style.display = 'none'
    return
  }
  document.getElementById('pie-section').style.display = ''

  const ctx = canvas.getContext('2d')
  pieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: PIE_ORDER,
      datasets: [{
        data:            values,
        backgroundColor: PIE_COLORS,
        borderWidth:     2,
        borderColor:     '#ede4d3'
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

  // Legend
  const legendEl = document.getElementById('pie-legend')
  if (legendEl) {
    legendEl.innerHTML = PIE_ORDER.map((label, i) => {
      const count = values[i]
      const pct   = total ? Math.round(count / total * 100) : 0
      return `
        <div class="pie-legend-item">
          <span class="pie-legend-dot" style="background:${PIE_COLORS[i]}"></span>
          <span class="pie-legend-label">${label}</span>
          <span class="pie-legend-pct">${count}&nbsp;·&nbsp;${pct}%</span>
        </div>`
    }).join('')
  }
}

// ── Formatting helpers ────────────────────────────────────────
function fmtDateLong (s) {
  const d      = new Date(s + 'T00:00:00')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}
function fmtTime12 (t) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hh     = h === 0 ? 12 : (h > 12 ? h - 12 : h)
  return `${hh}:${String(m).padStart(2,'0')} ${period}`
}
function escapeHtml (s) {
  return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))
}
function statusClass (s) {
  return s === 'In progress' ? 'progress' :
         s === 'Done'        ? 'done'     :
         s === 'Snoozed'     ? 'snoozed'  : 'pending'
}

// ── Filtering & sorting ───────────────────────────────────────
function getFiltered () {
  const search    = document.getElementById('search').value.toLowerCase()
  const fStatus   = document.getElementById('filter-status').value
  const fPriority = document.getElementById('filter-priority').value

  let list = tasks.filter(t => {
    if (search && !t.TaskName.toLowerCase().includes(search)) return false
    if (fStatus   !== 'all' && t.Status   !== fStatus)   return false
    if (fPriority !== 'all' && t.Priority !== fPriority) return false
    return true
  })

  list.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase() }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ?  1 : -1
    return 0
  })
  return list
}

function sortBy (key) {
  if (sortKey === key) { sortDir = sortDir === 'asc' ? 'desc' : 'asc' }
  else { sortKey = key; sortDir = 'asc' }
  render()
}

// ── Stats ─────────────────────────────────────────────────────
function renderStats () {
  const total    = tasks.length
  const done     = tasks.filter(t => t.Status === 'Done').length
  const progress = tasks.filter(t => t.Status === 'In progress').length
  const high     = tasks.filter(t => t.Priority === 'High' && t.Status !== 'Done').length
  document.getElementById('stat-total').textContent    = total
  document.getElementById('stat-done').textContent     = done
  document.getElementById('stat-progress').textContent = progress
  document.getElementById('stat-high').textContent     = high
  document.getElementById('stat-done-pct').textContent =
    total ? `${Math.round(done / total * 100)}% complete` : '0% complete'
}

// ── Table ─────────────────────────────────────────────────────
function render () {
  renderStats()
  renderPieChart()

  const list  = getFiltered()
  const tbody = document.getElementById('task-tbody')

  // Sort arrow indicators
  document.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('active')
    const arrow = th.querySelector('.sort-arrow')
    if (arrow) arrow.textContent = '↕'
  })
  const active = [...document.querySelectorAll('th.sortable')].find(th =>
    th.getAttribute('onclick')?.includes(`'${sortKey}'`))
  if (active) {
    active.classList.add('active')
    active.querySelector('.sort-arrow').textContent = sortDir === 'asc' ? '↑' : '↓'
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state"><p>No tasks match the current filters.</p></div>
      </td></tr>`
    return
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
      <td>${t.SendReminder
            ? '<span style="color:var(--sage);">&#9679;</span> On'
            : '<span style="color:var(--muted);">&#9675;</span> Off'}</td>
      <td>
        <div class="table-actions">
          ${t.Status !== 'Done'
            ? `<button class="icon-btn" onclick="markDone(${t.TaskID})" title="Mark done">&#10003;</button>`
            : ''}
          <button class="icon-btn" onclick="cycleStatus(${t.TaskID})" title="Cycle status">&#8635;</button>
          <button class="icon-btn danger" onclick="deleteTask(${t.TaskID})" title="Delete">&times;</button>
        </div>
      </td>
    </tr>
  `).join('')
}

// ── Actions (local only, no backend) ─────────────────────────
function markDone (id) {
  const t = tasks.find(x => x.TaskID === id)
  if (t) { t.Status = 'Done'; t.completedAt = new Date().toISOString(); render() }
}

function cycleStatus (id) {
  const order = ['Pending', 'In progress', 'Done', 'Snoozed']
  const t     = tasks.find(x => x.TaskID === id)
  if (t) {
    const idx = order.indexOf(t.Status)
    t.Status  = order[(idx + 1) % order.length]
    if (t.Status === 'Done') t.completedAt = new Date().toISOString()
    render()
  }
}

function deleteTask (id) {
  if (confirm('Delete this task?')) {
    tasks = tasks.filter(t => t.TaskID !== id)
    render()
  }
}

function resetFilters () {
  document.getElementById('search').value           = ''
  document.getElementById('filter-status').value   = 'all'
  document.getElementById('filter-priority').value = 'all'
  render()
}

// ── Notification bell ─────────────────────────────────────────
function toggleNotifDropdown () {
  document.getElementById('notif-dropdown').classList.toggle('open')
}

document.addEventListener('click', e => {
  const wrap = document.querySelector('.notif-wrap')
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('notif-dropdown')?.classList.remove('open')
  }
})

// ── Init ──────────────────────────────────────────────────────
render()



/* USE AFTER DATABASE IS FIXED
// ============================================================
//  js/tracking.js  —  Sample Tracking (static data, no backend)
// ============================================================

// ── Static sample tasks ───────────────────────────────────────
let tasks = [
  { TaskID: 1,  TaskName: 'Morning standup',  TaskDate: '2026-05-10', TaskTime: '09:00', TaskDuration: 30,  Priority: 'High',   Status: 'Done',        SendReminder: 1, completedAt: '2026-05-10T09:28:00' },
  { TaskID: 2,  TaskName: 'Review PR #42',    TaskDate: '2026-05-10', TaskTime: '10:00', TaskDuration: 45,  Priority: 'Medium', Status: 'Done',        SendReminder: 1, completedAt: '2026-05-10T11:15:00' },
  { TaskID: 3,  TaskName: 'Write tests',      TaskDate: '2026-05-10', TaskTime: '11:30', TaskDuration: 60,  Priority: 'Medium', Status: 'In progress', SendReminder: 1, completedAt: null },
  { TaskID: 4,  TaskName: 'Report due',       TaskDate: '2026-05-10', TaskTime: '14:00', TaskDuration: 20,  Priority: 'High',   Status: 'Pending',     SendReminder: 1, completedAt: null },
  { TaskID: 5,  TaskName: 'Deploy hotfix',    TaskDate: '2026-05-09', TaskTime: '16:00', TaskDuration: 90,  Priority: 'High',   Status: 'Done',        SendReminder: 0, completedAt: '2026-05-09T17:45:00' },
  { TaskID: 6,  TaskName: 'Weekly report',    TaskDate: '2026-05-08', TaskTime: '15:00', TaskDuration: 40,  Priority: 'Medium', Status: 'Done',        SendReminder: 1, completedAt: '2026-05-08T16:55:00' },
  { TaskID: 7,  TaskName: 'DB backup check',  TaskDate: '2026-05-07', TaskTime: '09:30', TaskDuration: 20,  Priority: 'Low',    Status: 'Done',        SendReminder: 0, completedAt: '2026-05-07T10:05:00' },
  { TaskID: 8,  TaskName: 'Plan sprint',      TaskDate: '2026-05-11', TaskTime: '10:00', TaskDuration: 60,  Priority: 'High',   Status: 'Pending',     SendReminder: 1, completedAt: null },
  { TaskID: 9,  TaskName: 'Code review docs', TaskDate: '2026-05-11', TaskTime: '14:00', TaskDuration: 30,  Priority: 'Low',    Status: 'Pending',     SendReminder: 0, completedAt: null },
  { TaskID: 10, TaskName: 'Update README',    TaskDate: '2026-05-09', TaskTime: '11:00', TaskDuration: 25,  Priority: 'Low',    Status: 'Done',        SendReminder: 0, completedAt: '2026-05-09T13:20:00' },
  { TaskID: 11, TaskName: 'Fix login bug',    TaskDate: '2026-05-08', TaskTime: '10:00', TaskDuration: 45,  Priority: 'High',   Status: 'Snoozed',     SendReminder: 1, completedAt: null },
]

let sortKey = 'TaskDate'
let sortDir = 'asc'

// ── Pie chart setup ───────────────────────────────────────────
const PIE_COLORS = ['#e9c46a', '#57cc99', '#e63946', '#1d2233']
const PIE_ORDER  = ['Pending', 'Completed', 'Completed late(30 mins)', 'Completed late(1-3hrs+)']

let pieChart = null

function scheduledEnd (t) {
  const d = new Date(`${t.TaskDate}T${t.TaskTime}:00`)
  d.setMinutes(d.getMinutes() + t.TaskDuration)
  return d
}

function classifyTask (t) {
  if (t.Status !== 'Done') return 'Pending'
  if (!t.completedAt) return 'Completed'
  const diffMin = (new Date(t.completedAt) - scheduledEnd(t)) / 60000
  if (diffMin <= 0)  return 'Completed'
  if (diffMin <= 30) return 'Completed late(30 mins)'
  return 'Completed late(1-3hrs+)'
}

function buildPieStats () {
  const counts = { 'Pending': 0, 'Completed': 0, 'Completed late(30 mins)': 0, 'Completed late(1-3hrs+)': 0 }
  tasks.forEach(t => { const k = classifyTask(t); if (counts[k] !== undefined) counts[k]++ })
  return counts
}

// Custom slice label plugin
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

function renderPieChart () {
  const canvas = document.getElementById('trackingPieChart')
  if (!canvas) return

  const stats  = buildPieStats()
  const values = PIE_ORDER.map(k => stats[k])
  const total  = values.reduce((a, b) => a + b, 0)

  if (pieChart) { pieChart.destroy(); pieChart = null }

  if (total === 0) {
    document.getElementById('pie-section').style.display = 'none'
    return
  }
  document.getElementById('pie-section').style.display = ''

  const ctx = canvas.getContext('2d')
  pieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: PIE_ORDER,
      datasets: [{
        data:            values,
        backgroundColor: PIE_COLORS,
        borderWidth:     2,
        borderColor:     '#ede4d3'
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

  // Legend
  const legendEl = document.getElementById('pie-legend')
  if (legendEl) {
    legendEl.innerHTML = PIE_ORDER.map((label, i) => {
      const count = values[i]
      const pct   = total ? Math.round(count / total * 100) : 0
      return `
        <div class="pie-legend-item">
          <span class="pie-legend-dot" style="background:${PIE_COLORS[i]}"></span>
          <span class="pie-legend-label">${label}</span>
          <span class="pie-legend-pct">${count}&nbsp;·&nbsp;${pct}%</span>
        </div>`
    }).join('')
  }
}

// ── Formatting helpers ────────────────────────────────────────
function fmtDateLong (s) {
  const d      = new Date(s + 'T00:00:00')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}
function fmtTime12 (t) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hh     = h === 0 ? 12 : (h > 12 ? h - 12 : h)
  return `${hh}:${String(m).padStart(2,'0')} ${period}`
}
function escapeHtml (s) {
  return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))
}
function statusClass (s) {
  return s === 'In progress' ? 'progress' :
         s === 'Done'        ? 'done'     :
         s === 'Snoozed'     ? 'snoozed'  : 'pending'
}

// ── Filtering & sorting ───────────────────────────────────────
function getFiltered () {
  const search    = document.getElementById('search').value.toLowerCase()
  const fStatus   = document.getElementById('filter-status').value
  const fPriority = document.getElementById('filter-priority').value

  let list = tasks.filter(t => {
    if (search && !t.TaskName.toLowerCase().includes(search)) return false
    if (fStatus   !== 'all' && t.Status   !== fStatus)   return false
    if (fPriority !== 'all' && t.Priority !== fPriority) return false
    return true
  })

  list.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase() }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ?  1 : -1
    return 0
  })
  return list
}

function sortBy (key) {
  if (sortKey === key) { sortDir = sortDir === 'asc' ? 'desc' : 'asc' }
  else { sortKey = key; sortDir = 'asc' }
  render()
}

// ── Stats ─────────────────────────────────────────────────────
function renderStats () {
  const total    = tasks.length
  const done     = tasks.filter(t => t.Status === 'Done').length
  const progress = tasks.filter(t => t.Status === 'In progress').length
  const high     = tasks.filter(t => t.Priority === 'High' && t.Status !== 'Done').length
  document.getElementById('stat-total').textContent    = total
  document.getElementById('stat-done').textContent     = done
  document.getElementById('stat-progress').textContent = progress
  document.getElementById('stat-high').textContent     = high
  document.getElementById('stat-done-pct').textContent =
    total ? `${Math.round(done / total * 100)}% complete` : '0% complete'
}

// ── Table ─────────────────────────────────────────────────────
function render () {
  renderStats()
  renderPieChart()

  const list  = getFiltered()
  const tbody = document.getElementById('task-tbody')

  // Sort arrow indicators
  document.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('active')
    const arrow = th.querySelector('.sort-arrow')
    if (arrow) arrow.textContent = '↕'
  })
  const active = [...document.querySelectorAll('th.sortable')].find(th =>
    th.getAttribute('onclick')?.includes(`'${sortKey}'`))
  if (active) {
    active.classList.add('active')
    active.querySelector('.sort-arrow').textContent = sortDir === 'asc' ? '↑' : '↓'
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state"><p>No tasks match the current filters.</p></div>
      </td></tr>`
    return
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
      <td>${t.SendReminder
            ? '<span style="color:var(--sage);">&#9679;</span> On'
            : '<span style="color:var(--muted);">&#9675;</span> Off'}</td>
      <td>
        <div class="table-actions">
          ${t.Status !== 'Done'
            ? `<button class="icon-btn" onclick="markDone(${t.TaskID})" title="Mark done">&#10003;</button>`
            : ''}
          <button class="icon-btn" onclick="cycleStatus(${t.TaskID})" title="Cycle status">&#8635;</button>
          <button class="icon-btn danger" onclick="deleteTask(${t.TaskID})" title="Delete">&times;</button>
        </div>
      </td>
    </tr>
  `).join('')
}

// ── Actions (local only, no backend) ─────────────────────────
function markDone (id) {
  const t = tasks.find(x => x.TaskID === id)
  if (t) { t.Status = 'Done'; t.completedAt = new Date().toISOString(); render() }
}

function cycleStatus (id) {
  const order = ['Pending', 'In progress', 'Done', 'Snoozed']
  const t     = tasks.find(x => x.TaskID === id)
  if (t) {
    const idx = order.indexOf(t.Status)
    t.Status  = order[(idx + 1) % order.length]
    if (t.Status === 'Done') t.completedAt = new Date().toISOString()
    render()
  }
}

function deleteTask (id) {
  if (confirm('Delete this task?')) {
    tasks = tasks.filter(t => t.TaskID !== id)
    render()
  }
}

function resetFilters () {
  document.getElementById('search').value           = ''
  document.getElementById('filter-status').value   = 'all'
  document.getElementById('filter-priority').value = 'all'
  render()
}

// ── Notification bell ─────────────────────────────────────────
function toggleNotifDropdown () {
  document.getElementById('notif-dropdown').classList.toggle('open')
}

document.addEventListener('click', e => {
  const wrap = document.querySelector('.notif-wrap')
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('notif-dropdown')?.classList.remove('open')
  }
})

// ── Init ──────────────────────────────────────────────────────
render()
*/

// ============================================================
//  js/tracking.js  —  Task tracking table & stats
//  Requires a valid session (tasc_userID in sessionStorage)
// ============================================================

const API = '/api'   // relative — works on any host/port

// ── Auth guard ────────────────────────────────────────────────
const SESSION_USERID = sessionStorage.getItem('tasc_userID')
if (!SESSION_USERID) window.location.href = 'login.html'

// ── State ─────────────────────────────────────────────────────
let tasks   = []
let sortKey = 'TaskDate'
let sortDir = 'asc'

// ── Pie chart setup ───────────────────────────────────────────
const PIE_COLORS = ['#e9c46a', '#57cc99', '#f4a261', '#e63946', '#1d2233']
const PIE_ORDER  = ['Pending', 'Completed', 'Completed late(30 mins)', 'Completed late(1-3hrs+)', 'Too late']
let   pieChart   = null

function scheduledEnd (t) {
  const d = new Date(`${t.TaskDate}T${t.TaskTime}:00`)
  d.setMinutes(d.getMinutes() + t.TaskDuration)
  return d
}

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

function buildPieStats () {
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

  pieChart = new Chart(canvas.getContext('2d'), {
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
  // s is YYYY-MM-DD string from server (dateStrings:true)
  const [year, month, day] = s.split('-').map(Number)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[month - 1]} ${day}, ${year}`
}
function fmtTime12 (t) {
  const [h, m] = t.split(':').map(Number)
  const hh     = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hh}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
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

// ── Edit modal (inline in tracking page) ─────────────────────
let editingTaskId = null

function openEditModal (id) {
  const t = tasks.find(x => x.TaskID === id)
  if (!t) return

  // Build a simple modal dynamically if it doesn't exist
  let overlay = document.getElementById('edit-modal')
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id        = 'edit-modal'
    overlay.className = 'modal-overlay'
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="serif" id="edit-modal-title">Edit Task</h3>
          <button class="modal-close" onclick="closeEditModal()">×</button>
        </div>
        <form id="edit-task-form" onsubmit="saveEdit(event)">
          <div class="modal-body">
            <div class="field">
              <label for="e-name">Task name</label>
              <input type="text" id="e-name" maxlength="255" required />
            </div>
            <div class="field-row">
              <div class="field">
                <label for="e-date">Date</label>
                <input type="date" id="e-date" required />
              </div>
              <div class="field">
                <label for="e-time">Time</label>
                <input type="time" id="e-time" required />
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="e-duration">Duration (min)</label>
                <input type="number" id="e-duration" min="1" max="32767" required />
              </div>
              <div class="field">
                <label for="e-priority">Priority</label>
                <select id="e-priority">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>
            <div class="field">
              <label for="e-status">Status</label>
              <select id="e-status">
                <option value="Pending">Pending</option>
                <option value="In progress">In progress</option>
                <option value="Done">Done</option>
                <option value="Snoozed">Snoozed</option>
              </select>
            </div>
            <div class="field">
              <label for="e-notes">Notes (optional)</label>
              <textarea id="e-notes" placeholder="Add details..."></textarea>
            </div>
            <div class="checkbox-row">
              <input type="checkbox" id="e-reminder" />
              <label for="e-reminder" style="text-transform:none;letter-spacing:0;font-size:0.9rem;color:var(--ink-soft);margin:0;">
                Send notification reminder
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" onclick="closeEditModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>`
    document.body.appendChild(overlay)
  }

  // Populate fields
  editingTaskId = t.TaskID
  document.getElementById('e-name').value       = t.TaskName
  document.getElementById('e-date').value       = t.TaskDate
  // TaskTime from MySQL is HH:MM:SS — input[type=time] needs HH:MM
  document.getElementById('e-time').value       = t.TaskTime.slice(0, 5)
  document.getElementById('e-duration').value   = t.TaskDuration
  document.getElementById('e-priority').value   = t.Priority
  document.getElementById('e-status').value     = t.Status
  document.getElementById('e-notes').value      = t.Notes || ''
  document.getElementById('e-reminder').checked = t.SendReminder === 1

  overlay.classList.add('open')
}

function closeEditModal () {
  const overlay = document.getElementById('edit-modal')
  if (overlay) overlay.classList.remove('open')
}

async function saveEdit (e) {
  e.preventDefault()
  // Normalise time to HH:MM:SS so MySQL TIME column always gets a valid value
  const rawTime  = document.getElementById('e-time').value || '00:00'
  const taskTime = rawTime.length === 5 ? rawTime + ':00' : rawTime

  const payload = {
    TaskName:     document.getElementById('e-name').value.trim(),
    TaskDate:     document.getElementById('e-date').value,
    TaskTime:     taskTime,
    TaskDuration: parseInt(document.getElementById('e-duration').value, 10) || 30,
    Priority:     document.getElementById('e-priority').value,
    Status:       document.getElementById('e-status').value,
    Notes:        document.getElementById('e-notes').value.trim() || null,
    SendReminder: document.getElementById('e-reminder').checked ? 1 : 0,
  }
  try {
    const res = await fetch(`${API}/tasks/${editingTaskId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert('Failed to save changes: ' + (err.error || res.status))
      return
    }
    closeEditModal()
    await loadTasks()
  } catch (err) {
    alert('Cannot reach server. Is it running?')
  }
}

// ── Table render ──────────────────────────────────────────────
function render () {
  renderStats()
  renderPieChart()

  const list  = getFiltered()
  const tbody = document.getElementById('task-tbody')

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

  tbody.innerHTML = list.map(t => {
    // Cycle button: disabled when already 'In progress'
    const cycleDisabled = t.Status === 'In progress'
    const cycleBtn = cycleDisabled
      ? `<button type="button" class="icon-btn" title="Already in progress" disabled style="opacity:0.3;cursor:not-allowed;">&#8635;</button>`
      : `<button type="button" class="icon-btn" onclick="event.stopPropagation();cycleStatus(${t.TaskID})" title="Set In progress">&#8635;</button>`

    return `
    <tr class="task-row ${t.Status === 'Done' ? 'done' : ''}" style="cursor:pointer;" onclick="openEditModal(${t.TaskID})" title="Click to edit">
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
        <div class="table-actions" onclick="event.stopPropagation()">
          ${t.Status !== 'Done'
            ? `<button type="button" class="icon-btn" onclick="event.stopPropagation();markDone(${t.TaskID})" title="Mark done">&#10003;</button>`
            : ''}
          ${cycleBtn}
          <button type="button" class="icon-btn danger" onclick="event.stopPropagation();deleteTask(${t.TaskID})" title="Delete">&times;</button>
        </div>
      </td>
    </tr>`
  }).join('')
}

// ── Actions ───────────────────────────────────────────────────
// markDone only sends Status — completedAt is not a DB column and
// was causing the PUT to be rejected with "No valid fields to update"
async function markDone (id) {
  try {
    const res = await fetch(`${API}/tasks/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ Status: 'Done' }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert('Failed to mark done: ' + (err.error || res.status))
      return
    }
    await loadTasks()
  } catch { alert('Cannot reach server.') }
}

async function cycleStatus (id) {
  // Cycle button always promotes a task to 'In progress'.
  // The button is disabled/hidden when already 'In progress'.
  const t = tasks.find(x => x.TaskID === id)
  if (!t || t.Status === 'In progress') return
  try {
    const res = await fetch(`${API}/tasks/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ Status: 'In progress' }),
    })
    if (!res.ok) throw new Error()
    await loadTasks()
  } catch { alert('Failed to update task.') }
}

async function deleteTask (id) {
  if (!confirm('Delete this task?')) return
  try {
    const res = await fetch(`${API}/tasks/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error()
    await loadTasks()
  } catch { alert('Failed to delete task.') }
}

function resetFilters () {
  document.getElementById('search').value           = ''
  document.getElementById('filter-status').value   = 'all'
  document.getElementById('filter-priority').value = 'all'
  render()
}

// ── Fetch tasks for this user ─────────────────────────────────
async function loadTasks () {
  try {
    const res = await fetch(`${API}/tasks?userID=${SESSION_USERID}`)
    if (!res.ok) throw new Error('Failed to fetch tasks')
    tasks = await res.json()
  } catch (err) {
    console.error('Tracking load error:', err.message)
    tasks = []
  }
  render()
  // Update notification dot every time tasks are (re)loaded
  const dot   = document.getElementById('notif-dot')
  const items = getNotifTasks(tasks)
  if (dot) dot.style.display = items.length ? 'block' : 'none'
}

// ── Notification bell ─────────────────────────────────────────
function toggleNotifDropdown () {
  const dd = document.getElementById('notif-dropdown')
  dd.classList.toggle('open')
  if (dd.classList.contains('open')) loadNotifications()
}

document.addEventListener('click', e => {
  const wrap = document.querySelector('.notif-wrap')
  if (wrap && !wrap.contains(e.target))
    document.getElementById('notif-dropdown')?.classList.remove('open')
})

function scheduledEnd_cal (t) {
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
    const endTime     = scheduledEnd_cal(t)
    const minsToStart = (startTime - now) / 60000
    const minsLeft    = (endTime - now) / 60000

    // Starting within 5 minutes
    if (minsToStart >= 0 && minsToStart <= 5)
      items.push({ task: t, type: 'starting', minsToStart: Math.round(minsToStart) })
    // Timer has ≤30 mins left
    else if (minsToStart < 0 && minsLeft > 0 && minsLeft <= 30)
      items.push({ task: t, type: 'timer', minsLeft: Math.round(minsLeft) })
    // Overdue
    else if (minsLeft < 0)
      items.push({ task: t, type: 'overdue', minsOver: Math.round(-minsLeft) })
  })
  const order = { overdue: 0, timer: 1, starting: 2 }
  items.sort((a, b) => order[a.type] - order[b.type])
  return items
}

const PRIORITY_HIGHLIGHT = { High: 'rgba(139,58,31,0.10)', Medium: 'rgba(201,116,42,0.10)', Low: 'rgba(107,125,90,0.10)' }
const PRIORITY_BORDER    = { High: 'var(--rust)', Medium: 'var(--amber)', Low: 'var(--sage)' }

async function loadNotifications () {
  try {
    const res = await fetch(`${API}/tasks?userID=${SESSION_USERID}`)
    if (!res.ok) { renderNotifItems([]); return }
    renderNotifItems(getNotifTasks(await res.json()))
  } catch { renderNotifItems([]) }
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
      <div class="notif-item" style="background:${bg};border-left:3px solid ${border};padding-left:1rem;cursor:pointer;" onclick="openNotifTask(${task.TaskID},'${task.TaskDate}')">
        <div class="notif-item-tag ${tagClass}">${tagLabel}</div>
        <div class="notif-item-title">${task.TaskName}</div>
        <div class="notif-item-sub">${subText} · ${fmtTime12(task.TaskTime)} · ${task.Priority} priority</div>
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
loadTasks()
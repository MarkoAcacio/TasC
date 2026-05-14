// ============================================================
//  js/calendar.js  —  Calendar view
//  Requires a valid session (tasc_userID in sessionStorage)
// ============================================================

const API = '/api'   // relative — works on any host/port

// ── Auth guard ────────────────────────────────────────────────
const SESSION_USERID = sessionStorage.getItem('tasc_userID')
if (!SESSION_USERID) window.location.href = 'login.html'

// ── State ─────────────────────────────────────────────────────
let tasks        = []
let viewDate     = new Date()
let selectedDate = new Date().toISOString().slice(0, 10)
let editingTaskId = null

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// ── Formatting helpers ────────────────────────────────────────
function fmtDate (d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtTime12 (t) {
  const [h, m] = t.split(':').map(Number)
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hh}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// ── Fetch all tasks for logged-in user ────────────────────────
async function loadTasks () {
  try {
    const res = await fetch(`${API}/tasks?userID=${SESSION_USERID}`)
    if (!res.ok) throw new Error('Failed to fetch tasks')
    tasks = await res.json()
  } catch (err) {
    console.error('Calendar load error:', err.message)
    tasks = []
  }
  renderCalendar()
  renderDetail()
  updateQuickStats()
}

// ── Calendar rendering ────────────────────────────────────────
function renderCalendar () {
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  document.getElementById('month-label').textContent = `${MONTHS[month]} ${year}`

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays    = new Date(year, month, 0).getDate()
  const todayStr    = new Date().toISOString().slice(0, 10)

  const grid = document.getElementById('days-grid')
  grid.innerHTML = ''

  for (let i = firstDay - 1; i >= 0; i--)
    grid.appendChild(makeDayCell(new Date(year, month - 1, prevDays - i), true, todayStr))

  for (let d = 1; d <= daysInMonth; d++)
    grid.appendChild(makeDayCell(new Date(year, month, d), false, todayStr))

  const trailing = (7 - ((firstDay + daysInMonth) % 7)) % 7
  for (let d = 1; d <= trailing; d++)
    grid.appendChild(makeDayCell(new Date(year, month + 1, d), true, todayStr))
}

function makeDayCell (date, otherMonth, todayStr) {
  const cell = document.createElement('div')
  const dStr = fmtDate(date)
  cell.className = 'day' + (otherMonth ? ' other-month' : '')
  if (dStr === todayStr)    cell.classList.add('today')
  if (dStr === selectedDate) cell.classList.add('selected')

  const num = document.createElement('div')
  num.className   = 'day-num'
  num.textContent = date.getDate()
  cell.appendChild(num)

  const dayTasks = tasks.filter(t => t.TaskDate === dStr)
  if (dayTasks.length) {
    const dots = document.createElement('div')
    dots.className = 'day-dots'
    dayTasks.slice(0, 4).forEach(t => {
      const dot = document.createElement('div')
      dot.className = 'dot ' + t.Priority.toLowerCase()
      dots.appendChild(dot)
    })
    cell.appendChild(dots)
  }

  cell.addEventListener('click', () => {
    selectedDate = dStr
    renderCalendar()
    renderDetail()
  })
  return cell
}

function renderDetail () {
  const date = new Date(selectedDate + 'T00:00:00')
  document.getElementById('detail-date').textContent =
    `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()].slice(0,3)} ${date.getDate()}`

  const dayTasks = tasks
    .filter(t => t.TaskDate === selectedDate)
    .sort((a, b) => a.TaskTime.localeCompare(b.TaskTime))

  document.getElementById('detail-count').textContent =
    dayTasks.length === 0 ? 'No tasks scheduled' :
    dayTasks.length === 1 ? '1 task scheduled'   : `${dayTasks.length} tasks scheduled`

  const list = document.getElementById('task-list')
  if (dayTasks.length === 0) {
    list.innerHTML = '<div class="empty-day">A clear day.</div>'
    return
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
  `).join('')
}

function updateQuickStats () {
  const now       = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  const weekEnd   = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const weekTasks = tasks.filter(t => {
    const d = new Date(t.TaskDate + 'T00:00:00')
    return d >= weekStart && d <= weekEnd
  })
  const weekDone  = weekTasks.filter(t => t.Status === 'Done').length
  const pct       = weekTasks.length ? Math.round(weekDone / weekTasks.length * 100) : 0

  document.getElementById('qs-week').textContent = `${weekTasks.length} tasks`
  document.getElementById('qs-pct').textContent  = `${pct}%`
}

// ── Month nav ─────────────────────────────────────────────────
function changeMonth (delta) {
  viewDate.setMonth(viewDate.getMonth() + delta)
  renderCalendar()
}
function goToday () {
  viewDate     = new Date()
  selectedDate = new Date().toISOString().slice(0, 10)
  renderCalendar()
  renderDetail()
}

// ── Modal ─────────────────────────────────────────────────────
function openModal (task = null) {
  const form = document.getElementById('task-form')
  form.reset()
  document.getElementById('t-date').value = selectedDate

  if (task) {
    editingTaskId = task.TaskID
    document.querySelector('.modal-header h3').textContent = 'Edit Task'
    document.getElementById('t-name').value     = task.TaskName
    document.getElementById('t-date').value     = task.TaskDate
    document.getElementById('t-time').value     = task.TaskTime
    document.getElementById('t-duration').value = task.TaskDuration
    document.getElementById('t-priority').value = task.Priority
    document.getElementById('t-status').value   = task.Status
    document.getElementById('t-notes').value    = task.Notes || ''
    document.getElementById('t-reminder').checked = task.SendReminder === 1
  } else {
    editingTaskId = null
    document.querySelector('.modal-header h3').textContent = 'New Task'
  }
  document.getElementById('task-modal').classList.add('open')
}
function closeModal () {
  document.getElementById('task-modal').classList.remove('open')
}
function editTask (id) {
  const t = tasks.find(x => x.TaskID === id)
  if (t) openModal(t)
}

// ── Save task (create or update) ──────────────────────────────
async function saveTask (e) {
  e.preventDefault()
  const fd = new FormData(e.target)

  // Normalise time to HH:MM:SS so MySQL TIME column always gets a valid value
  const rawTime = fd.get('TaskTime') || '00:00'
  const taskTime = rawTime.length === 5 ? rawTime + ':00' : rawTime

  const payload = {
    UserID:       parseInt(SESSION_USERID, 10),
    TaskName:     fd.get('TaskName'),
    TaskDate:     fd.get('TaskDate'),
    TaskTime:     taskTime,
    TaskDuration: parseInt(fd.get('TaskDuration'), 10) || 30,
    Priority:     fd.get('Priority'),
    Status:       fd.get('Status'),
    Notes:        fd.get('Notes') || null,
    SendReminder: fd.get('SendReminder') ? 1 : 0,
  }

  try {
    let res
    if (editingTaskId) {
      res = await fetch(`${API}/tasks/${editingTaskId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
    } else {
      res = await fetch(`${API}/tasks`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to save task.')
      return
    }

    selectedDate = payload.TaskDate
    viewDate     = new Date(payload.TaskDate + 'T00:00:00')
    closeModal()
    await loadTasks()

  } catch {
    alert('Cannot reach server. Is it running?')
  }
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

function openNotifTask (id, dateStr) {
  // Navigate calendar to the task's date, close dropdown, open edit modal
  selectedDate = dateStr
  viewDate     = new Date(dateStr + 'T00:00:00')
  renderCalendar()
  renderDetail()
  document.getElementById('notif-dropdown')?.classList.remove('open')
  const t = tasks.find(x => x.TaskID === id)
  if (t) openModal(t)
}

// Poll notifications every 60 s
loadNotifications()
setInterval(loadNotifications, 60000)

// ── Init ──────────────────────────────────────────────────────
loadTasks()
// ============================================================
//  js/index.js  —  Sign in, Register + Notification bell
// ============================================================

const API = 'http://localhost:3000/api'

// ── Tab switching ────────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'))
    tab.classList.add('active')
    document.querySelector(`[data-form="${tab.dataset.tab}"]`).classList.add('active')
  })
})

// ── Helpers ──────────────────────────────────────────────────
function showError (formId, message) {
  let err = document.querySelector(`#${formId} .auth-error`)
  if (!err) {
    err = document.createElement('p')
    err.className = 'auth-error'
    err.style.cssText = 'color:var(--rust);font-size:0.85rem;margin-bottom:1rem;padding:0.6rem 0.9rem;background:rgba(139,58,31,0.07);border-left:3px solid var(--rust);'
    document.getElementById(formId).prepend(err)
  }
  err.textContent = message
}
function clearError (formId) {
  const err = document.querySelector(`#${formId} .auth-error`)
  if (err) err.remove()
}
function saveSession (token, user, remember) {
  const storage = remember ? localStorage : sessionStorage
  storage.setItem('tasc_token', token)
  storage.setItem('tasc_user', JSON.stringify(user))
}

// ── Sign In ──────────────────────────────────────────────────
async function handleSignIn (e) {
  e.preventDefault()
  clearError('signin-form')
  const email    = document.getElementById('signin-email').value.trim()
  const password = document.getElementById('signin-password').value
  const remember = document.getElementById('remember').checked
  try {
    const res  = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) { showError('signin-form', data.error || 'Sign in failed'); return }
    saveSession(data.token, data.user, remember)
    window.location.href = 'calendar.html'
  } catch { showError('signin-form', 'Cannot reach server. Is it running?') }
}

// ── Register ─────────────────────────────────────────────────
async function handleRegister (e) {
  e.preventDefault()
  clearError('register-form')
  const firstName = document.getElementById('reg-first').value.trim()
  const lastName  = document.getElementById('reg-last').value.trim()
  const email     = document.getElementById('reg-email').value.trim()
  const password  = document.getElementById('reg-password').value
  try {
    const res  = await fetch(`${API}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, password }),
    })
    const data = await res.json()
    if (!res.ok) { showError('register-form', data.error || 'Registration failed'); return }
    const loginRes  = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const loginData = await loginRes.json()
    if (loginRes.ok) {
      saveSession(loginData.token, loginData.user, false)
      window.location.href = 'calendar.html'
    } else {
      document.querySelector('[data-tab="signin"]').click()
      document.getElementById('signin-email').value = email
    }
  } catch { showError('register-form', 'Cannot reach server. Is it running?') }
}

// ── Notification Bell ─────────────────────────────────────────
function toggleNotifDropdown () {
  const dd = document.getElementById('notif-dropdown')
  dd.classList.toggle('open')
  if (dd.classList.contains('open')) loadNotifications()
}

document.addEventListener('click', e => {
  const wrap = document.querySelector('.notif-wrap')
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('notif-dropdown')?.classList.remove('open')
  }
})

async function loadNotifications () {
  const token = localStorage.getItem('tasc_token') || sessionStorage.getItem('tasc_token')
  if (!token) { renderNotifItems([]); return }
  try {
    const res   = await fetch(`${API}/tasks`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) { renderNotifItems([]); return }
    const tasks = await res.json()
    renderNotifItems(getUrgentTasks(tasks))
  } catch { renderNotifItems([]) }
}

function getUrgentTasks (tasks) {
  const now = new Date()
  const urgent = []
  tasks.forEach(t => {
    if (['Done','Completed','Cancelled'].includes(t.Status)) return
    const taskTime = new Date(`${t.TaskDate}T${t.TaskTime}`)
    const diffMin  = (taskTime - now) / 60000
    if (diffMin >= 0 && diffMin <= 30)
      urgent.push({ task: t, type: 'urgent', diffMin: Math.round(diffMin) })
    else if (t.Priority === 'High' && diffMin > 0 && diffMin <= 60)
      urgent.push({ task: t, type: 'high', diffMin: Math.round(diffMin) })
  })
  return urgent.sort((a, b) => a.diffMin - b.diffMin)
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
  list.innerHTML = items.map(({ task, type, diffMin }) => `
    <div class="notif-item">
      <div class="notif-item-tag ${type}">
        ${type === 'urgent' ? '⚡ Starting soon' : '🔴 High priority'}
      </div>
      <div class="notif-item-title">${task.TaskName}</div>
      <div class="notif-item-sub">
        ${diffMin === 0 ? 'Starting now' : `In ${diffMin} min`} ·
        ${formatTime(task.TaskTime)} · ${task.Priority} priority
      </div>
    </div>
  `).join('')
}

function formatTime (timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

// Poll every 60s if logged in
const _token = localStorage.getItem('tasc_token') || sessionStorage.getItem('tasc_token')
if (_token) { loadNotifications(); setInterval(loadNotifications, 60000) }

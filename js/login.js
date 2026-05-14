// ============================================================
//  js/login.js  —  Auth page (Sign In & Register)
//  Talks to POST /api/auth/login and /api/auth/register
// ============================================================

const API = '/api'   // relative — works on any host/port

// ── If already logged in, skip straight to dashboard ─────────
;(function checkAuth () {
  const userID = sessionStorage.getItem('tasc_userID')
  if (userID) window.location.href = 'index.html'
})()

// ── Tab switching ─────────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'))
    btn.classList.add('active')
    document.querySelector(`[data-form="${btn.dataset.tab}"]`).classList.add('active')
  })
})

// ── Error helpers ─────────────────────────────────────────────
function showError (formId, message) {
  let err = document.querySelector(`#${formId} .auth-error`)
  if (!err) {
    err = document.createElement('p')
    err.className = 'auth-error'
    document.getElementById(formId).prepend(err)
  }
  err.textContent = message
}
function clearError (formId) {
  const err = document.querySelector(`#${formId} .auth-error`)
  if (err) err.remove()
}

// ── Save session (UserID + display name) ──────────────────────
function saveSession (userID, firstName) {
  sessionStorage.setItem('tasc_userID',    userID)
  sessionStorage.setItem('tasc_firstName', firstName)
}

// ── Sign In ───────────────────────────────────────────────────
async function handleSignIn (e) {
  e.preventDefault()
  clearError('signin-form')

  const email    = document.getElementById('signin-email').value.trim()
  const password = document.getElementById('signin-password').value

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      showError('signin-form', data.error || 'Invalid email or password.')
      return
    }

    // data = { userID, firstName }
    saveSession(data.userID, data.firstName)
    window.location.href = 'index.html'

  } catch {
    showError('signin-form', 'Cannot reach server. Is it running?')
  }
}

// ── Register ──────────────────────────────────────────────────
async function handleRegister (e) {
  e.preventDefault()
  clearError('register-form')

  const firstName = document.getElementById('reg-first').value.trim()
  const lastName  = document.getElementById('reg-last').value.trim()
  const email     = document.getElementById('reg-email').value.trim()
  const password  = document.getElementById('reg-password').value

  try {
    const res  = await fetch(`${API}/auth/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ firstName, lastName, email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      showError('register-form', data.error || 'Registration failed.')
      return
    }

    // data = { userID, firstName } — already logged in server-side
    saveSession(data.userID, data.firstName)
    window.location.href = 'index.html'

  } catch {
    showError('register-form', 'Cannot reach server. Is it running?')
  }
}
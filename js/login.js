// Tab switching
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`[data-form="${btn.dataset.tab}"]`).classList.add('active');
  });
});

// Form handlers — front-end only, no backend
function handleSignIn(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  console.log('SIGN IN payload (matches Users table):', data);
  alert(`Signed in as ${data.Email}\n(Front-end only — redirecting to Calendar)`);
  window.location.href = 'calendar.html';
}
function handleRegister(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  console.log('REGISTER payload (matches Users table):', data);
  alert(`Account created for ${data.FirstName} ${data.LastName}\n(Front-end only — redirecting to Calendar)`);
  window.location.href = 'calendar.html';
}

/* ONCE DATABASE IS FULLY FIXED
// ============================================================
//  js/login.js  —  Dedicated login page
//  Same logic as index.js but no nav links exposed
// ============================================================

const API = 'http://localhost:3000/api'

// ── Tab switching ────────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'))
    tab.classList.add('active')
    document.getElementById(`${tab.dataset.tab}-form`).classList.add('active')
  })
})

// ── If already logged in, go straight to calendar ────────────
;(function checkAuth () {
  const token = localStorage.getItem('tasc_token') || sessionStorage.getItem('tasc_token')
  if (token) window.location.href = 'calendar.html'
})()

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
function saveSession (token, user, remember) {
  const storage = remember ? localStorage : sessionStorage
  storage.setItem('tasc_token', token)
  storage.setItem('tasc_user', JSON.stringify(user))
}

// ── Sign In ───────────────────────────────────────────────────
async function handleSignIn (e) {
  e.preventDefault()
  clearError('signin-form')

  const email    = document.getElementById('signin-email').value.trim()
  const password = document.getElementById('signin-password').value
  const remember = document.getElementById('remember').checked

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      showError('signin-form', data.error || 'Invalid email or password')
      return
    }

    saveSession(data.token, data.user, remember)
    window.location.href = 'calendar.html'

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
      showError('register-form', data.error || 'Registration failed')
      return
    }

    // Auto login after register
    const loginRes  = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    const loginData = await loginRes.json()

    if (loginRes.ok) {
      saveSession(loginData.token, loginData.user, false)
      window.location.href = 'calendar.html'
    } else {
      document.querySelector('[data-tab="signin"]').click()
      document.getElementById('signin-email').value = email
    }

  } catch {
    showError('register-form', 'Cannot reach server. Is it running?')
  }
}
*/
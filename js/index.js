// ============================================================
//  js/index.js  — Auth page: Sign In & Register
//  Talks to the Express API (server.js) via fetch + JWT
// ============================================================

// ── Tab switching ────────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`[data-form="${btn.dataset.tab}"]`).classList.add('active');
    clearErrors();
  });
});

// ── If already signed in, go straight to calendar ───────────
if (localStorage.getItem('tasc_token')) {
  window.location.href = 'calendar.html';
}

// ── Helpers ──────────────────────────────────────────────────
function setError(msg) {
  let el = document.getElementById('auth-error');
  if (!el) {
    el = document.createElement('p');
    el.id = 'auth-error';
    el.style.cssText = 'color:#c0392b;font-size:.9rem;margin:.5rem 0 0;';
    document.querySelector('.auth-panel').prepend(el);
  }
  el.textContent = msg;
}

function clearErrors() {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = '';
}

function setButtonLoading(form, loading) {
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = loading;
  btn.textContent = loading
    ? 'Please wait…'
    : (form.id === 'signin-form' ? 'Sign in' : 'Create account');
}

// ── Sign In ──────────────────────────────────────────────────
async function handleSignIn(e) {
  e.preventDefault();
  clearErrors();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  setButtonLoading(form, true);

  try {
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: data.Email, password: data.Password }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || 'Sign-in failed. Please try again.');
      return;
    }

    localStorage.setItem('tasc_token', json.token);
    localStorage.setItem('tasc_user',  JSON.stringify(json.user));
    window.location.href = 'calendar.html';

  } catch {
    setError('Network error — is the server running?');
  } finally {
    setButtonLoading(form, false);
  }
}

// ── Register ─────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  clearErrors();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  setButtonLoading(form, true);

  try {
    const res  = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        firstName: data.FirstName,
        lastName:  data.LastName,
        email:     data.Email,
        password:  data.Password,
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || 'Registration failed. Please try again.');
      return;
    }

    // Auto-login after registration
    const loginRes  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: data.Email, password: data.Password }),
    });
    const loginJson = await loginRes.json();
    if (loginRes.ok) {
      localStorage.setItem('tasc_token', loginJson.token);
      localStorage.setItem('tasc_user',  JSON.stringify(loginJson.user));
    }

    window.location.href = 'calendar.html';

  } catch {
    setError('Network error — is the server running?');
  } finally {
    setButtonLoading(form, false);
  }
}

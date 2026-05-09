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

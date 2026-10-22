const dialog = document.querySelector('#profile-dialog');
const form = document.querySelector('#profile-form');
const toast = document.querySelector('#toast');
let toastTimer;

function announce(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function openProfile() {
  if (!dialog.open) dialog.showModal();
}

function getSavedProfile() {
  try { return JSON.parse(localStorage.getItem('manual-demo-profile') || 'null'); }
  catch { return null; }
}

function getRequests() {
  try { return JSON.parse(localStorage.getItem('manual-demo-requests') || '[]'); }
  catch { return []; }
}

function populateProfile(profile) {
  if (!profile) return;
  form.elements.nickname.value = profile.nickname || '';
  form.elements.location.value = profile.location || '';
  form.elements.realName.value = profile.realName || '';
  form.elements.showRealName.checked = Boolean(profile.showRealName);
  const savedInterests = new Set(profile.interests || []);
  form.querySelectorAll('[name="interests"]').forEach((input) => { input.checked = savedInterests.has(input.value); });
}

document.querySelectorAll('#signup-open,#hero-signup,#discover-signup,#interests-signup,#privacy-signup,#final-signup,#login-open').forEach((button) => {
  button.addEventListener('click', () => {
    openProfile();
    const profile = getSavedProfile();
    populateProfile(button.id === 'login-open' ? profile : null);
    document.querySelector('#dialog-title').textContent = button.id === 'login-open' && profile ? 'Tu perfil de demostración.' : 'Crea tu perfil Manual.';
    document.querySelector('#form-feedback').textContent = '';
  });
});

document.querySelector('#profile-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const profile = {
    nickname: String(data.get('nickname')).trim(),
    location: String(data.get('location') || '').trim(),
    realName: String(data.get('realName') || '').trim(),
    showRealName: data.get('showRealName') === 'on',
    interests: data.getAll('interests'),
    savedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem('manual-demo-profile', JSON.stringify(profile));
    const profileButton = document.querySelector('#signup-open');
    profileButton.textContent = 'Mi perfil';
    const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗'; profileButton.append(arrow);
    document.querySelector('#form-feedback').textContent = `Perfil de demostración guardado para ${profile.nickname}. Solo está en este navegador.`;
    announce('Perfil guardado en este dispositivo. No se ha creado una cuenta online.');
  } catch {
    document.querySelector('#form-feedback').textContent = 'El navegador no permitió guardar la vista previa. Puedes seguir probando sin guardar.';
  }
});

document.querySelectorAll('[data-connect]').forEach((button) => {
  button.addEventListener('click', () => {
    const name = button.dataset.connect;
    const requests = new Set(getRequests());
    if (requests.has(name)) requests.delete(name); else requests.add(name);
    try { localStorage.setItem('manual-demo-requests', JSON.stringify([...requests])); } catch {}
    button.classList.toggle('sent', requests.has(name));
    const sent = button.classList.contains('sent');
    button.textContent = sent ? '✓' : '+';
    button.setAttribute('aria-label', `${sent ? 'Solicitud de ejemplo marcada para' : 'Enviar solicitud a'} ${name}`);
    announce(sent ? `Solicitud de demostración guardada para ${name}. No se envió a una persona real.` : `Solicitud de demostración retirada para ${name}.`);
  });
});

document.querySelectorAll('[data-connect]').forEach((button) => {
  const isSent = getRequests().includes(button.dataset.connect);
  button.classList.toggle('sent', isSent);
  button.textContent = isSent ? '✓' : '+';
});

document.querySelector('[data-preview-connect]').addEventListener('click', () => {
  openProfile();
  announce('Crea una vista previa de perfil para conocer el flujo.');
});

document.querySelectorAll('[data-chip]').forEach((chip) => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('selected');
    chip.setAttribute('aria-pressed', String(chip.classList.contains('selected')));
  });
});

document.querySelector('#filter-toggle').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const active = button.classList.toggle('active');
  button.setAttribute('aria-pressed', String(active));
  const cards = [...document.querySelectorAll('.person-card')];
  cards.sort((a, b) => {
    const scoreA = Number(a.querySelector('.person-match b').textContent);
    const scoreB = Number(b.querySelector('.person-match b').textContent);
    return active ? scoreB - scoreA : scoreA - scoreB;
  });
  cards.forEach((card) => document.querySelector('.people-panel').insertBefore(card, document.querySelector('.demo-disclaimer')));
  button.querySelector('span').textContent = active ? 'Más coincidencias' : 'Afinidades';
  announce(active ? 'Perfiles de ejemplo ordenados por intereses en común.' : 'Perfiles de ejemplo ordenados por afinidad creciente.');
});

document.querySelector('#mobile-menu').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const nav = document.querySelector('.desktop-nav');
  const open = nav.classList.toggle('open');
  button.setAttribute('aria-expanded', String(open));
  button.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
});

document.querySelectorAll('.desktop-nav a').forEach((link) => link.addEventListener('click', () => {
  document.querySelector('.desktop-nav').classList.remove('open');
  document.querySelector('#mobile-menu').setAttribute('aria-expanded', 'false');
}));

const savedProfile = getSavedProfile();
if (savedProfile?.nickname) {
  const profileButton = document.querySelector('#signup-open');
  profileButton.textContent = 'Mi perfil';
  const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗'; profileButton.append(arrow);
}

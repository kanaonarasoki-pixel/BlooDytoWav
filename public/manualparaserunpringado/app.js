const dialog = document.querySelector('#profile-dialog');
const form = document.querySelector('#profile-form');
const toast = document.querySelector('#toast');
const demoPeople = [
  { name: 'jules.exe', place: 'Bilbao', interests: ['Hades', 'Anime', 'Indie rock'], initial: 'J' },
  { name: 'noa.jpg', place: 'Valencia', interests: ['Ghibli', 'Manga', 'Lo-fi'], initial: 'N' },
  { name: 'river.wav', place: 'Comparte su zona al conectar', interests: ['Celeste', 'Pixel art', 'J-Rock'], initial: 'R' }
];
let toastTimer;

function read(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
  catch { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function announce(message) {
  toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}
function getProfile() { return read('manual-demo-profile', null); }
function getPosts() { return read('manual-demo-posts', []); }
function getRequests() { return read('manual-demo-requests', []); }
function openProfile() {
  const profile = getProfile();
  if (profile) {
    form.elements.nickname.value = profile.nickname || '';
    form.elements.location.value = profile.location || '';
    form.elements.realName.value = profile.realName || '';
    form.elements.showRealName.checked = Boolean(profile.showRealName);
    const chosen = new Set(profile.interests || []);
    form.querySelectorAll('[name="interests"]').forEach(input => input.checked = chosen.has(input.value));
  } else form.reset();
  document.querySelector('#dialog-title').textContent = profile ? 'Edita tu perfil.' : 'Crea tu perfil Manual.';
  document.querySelector('#form-feedback').textContent = '';
  if (!dialog.open) dialog.showModal();
}
function setView(name) {
  document.querySelector('#app-view').hidden = name === 'acerca';
  document.querySelector('#landing-view').hidden = name !== 'acerca';
  document.querySelector('#landing-footer').hidden = name !== 'acerca';
  document.querySelectorAll('.app-view').forEach(panel => {
    const active = panel.dataset.panel === name;
    panel.hidden = !active; panel.classList.toggle('active', active);
  });
  document.querySelectorAll('.app-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === name));
  document.querySelectorAll('[data-app-nav]').forEach(link => link.classList.toggle('nav-current', link.dataset.appNav === name));
  history.replaceState(null, '', name === 'acerca' ? '#como-funciona' : '#app');
  if (name === 'solicitudes') renderRequests();
  if (name === 'perfil') renderProfile();
}
function renderPeople() {
  const container = document.querySelector('#explore-list');
  const profile = getProfile();
  container.innerHTML = demoPeople.map(person => {
    const shared = profile ? person.interests.filter(item => (profile.interests || []).some(interest => item.toLowerCase().includes(interest.toLowerCase()) || interest.toLowerCase().includes(item.toLowerCase()))).length : 0;
    const requested = getRequests().includes(person.name);
    return `<article class="explore-card"><div class="explore-avatar">${person.initial}</div><div class="explore-person"><b>${person.name}</b><small>${person.place} · perfil de ejemplo</small><div class="explore-tags">${person.interests.map(item => `<span>${item}</span>`).join('')}</div>${shared ? `<small>${shared} intereses que coinciden</small>` : ''}</div><button class="button ${requested ? 'button-outline' : 'button-blue'} button-small" data-request="${person.name}">${requested ? 'Solicitud guardada ✓' : 'Conectar +'}</button></article>`;
  }).join('');
  container.querySelectorAll('[data-request]').forEach(button => button.addEventListener('click', () => {
    const requests = new Set(getRequests());
    if (requests.has(button.dataset.request)) requests.delete(button.dataset.request); else requests.add(button.dataset.request);
    save('manual-demo-requests', [...requests]); renderPeople(); renderRequests(); announce('Solicitud de prueba guardada en este navegador; no se envió a una persona real.');
  }));
}
function renderPosts() {
  const container = document.querySelector('#feed-list');
  const profile = getProfile();
  const posts = getPosts();
  if (!posts.length) {
    container.innerHTML = `<article class="empty-state"><span>✳</span><h3>Tu feed empieza aquí</h3><p>Comparte una recomendación, una idea o algo que te haya alegrado el día.</p></article>`;
    return;
  }
  container.innerHTML = posts.map(post => {
    const liked = (post.likes || []).includes(profile?.nickname || 'tú');
    return `<article class="feed-post" data-post="${post.id}"><div class="post-head"><span class="post-avatar">${escapeHtml((post.nickname || '?').slice(0, 1).toUpperCase())}</span><div><b>${escapeHtml(post.nickname || 'Anónimo')}</b><small>${new Date(post.createdAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</small></div></div><p class="post-body">${escapeHtml(post.text)}</p><div class="post-actions"><button class="like-button ${liked ? 'liked' : ''}" data-like="${post.id}" aria-pressed="${liked}">${liked ? '♥' : '♡'} Me gusta · ${(post.likes || []).length}</button><span>Solo visible en este dispositivo</span></div></article>`;
  }).join('');
  container.querySelectorAll('[data-like]').forEach(button => button.addEventListener('click', () => {
    const who = getProfile()?.nickname || 'tú';
    const next = getPosts().map(post => {
      if (post.id !== button.dataset.like) return post;
      const likes = new Set(post.likes || []); likes.has(who) ? likes.delete(who) : likes.add(who);
      return { ...post, likes: [...likes] };
    });
    save('manual-demo-posts', next); renderPosts();
  }));
}
function renderRequests() {
  const container = document.querySelector('#requests-list');
  const names = getRequests();
  document.querySelector('#request-count').textContent = names.length;
  container.innerHTML = names.length ? names.map(name => {
    const person = demoPeople.find(item => item.name === name);
    return `<article class="request-card"><span class="explore-avatar">${person?.initial || '?'}</span><div><b>${escapeHtml(name)}</b><small>Solicitud de demostración guardada localmente</small></div><button class="remove-request" data-remove="${escapeHtml(name)}">Retirar</button></article>`;
  }).join('') : '<div class="empty-state"><span>♡</span><h3>Aún no tienes solicitudes</h3><p>Cuando marques conectar en Explorar, aparecerán aquí.</p><button class="button button-blue button-small" data-go-explore>Explorar perfiles</button></div>';
  container.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
    save('manual-demo-requests', getRequests().filter(name => name !== button.dataset.remove)); renderRequests(); renderPeople(); announce('Solicitud retirada.');
  }));
  container.querySelector('[data-go-explore]')?.addEventListener('click', () => setView('explorar'));
}
function renderProfile() {
  const profile = getProfile();
  const card = document.querySelector('#profile-card');
  if (!profile) {
    card.innerHTML = '<div class="empty-state"><span>◉</span><h3>Empieza por tu perfil</h3><p>Elige un nickname y añade los intereses que quieras compartir.</p><button class="button button-blue" data-open-profile>Crear mi perfil</button></div>';
    card.querySelector('[data-open-profile]').addEventListener('click', openProfile);
    return;
  }
  card.innerHTML = `<div class="profile-card-top"><span class="profile-big-avatar">${escapeHtml(profile.nickname.slice(0,1).toUpperCase())}</span><div><span class="eyebrow">TU NICKNAME</span><h3>${escapeHtml(profile.nickname)}</h3><p>${escapeHtml(profile.location || 'Ubicación no compartida')}</p></div></div><p class="profile-realname">${profile.showRealName && profile.realName ? `Nombre visible: ${escapeHtml(profile.realName)}` : 'Tu nombre real está oculto.'}</p><div class="profile-tags">${(profile.interests || []).length ? profile.interests.map(item => `<span>${escapeHtml(item)}</span>`).join('') : '<small>Aún no has añadido intereses.</small>'}</div><p class="local-note">Este perfil solo existe en el almacenamiento de este navegador. No es una cuenta online.</p>`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

document.querySelectorAll('[data-open-profile],#signup-open,#login-open,#hero-signup,#discover-signup,#interests-signup,#privacy-signup,#final-signup').forEach(button => button.addEventListener('click', openProfile));
document.querySelector('#profile-form').addEventListener('submit', event => {
  event.preventDefault(); if (!form.reportValidity()) return;
  const data = new FormData(form);
  const profile = { nickname: String(data.get('nickname')).trim(), location: String(data.get('location') || '').trim(), realName: String(data.get('realName') || '').trim(), showRealName: data.get('showRealName') === 'on', interests: data.getAll('interests'), savedAt: new Date().toISOString() };
  try {
    save('manual-demo-profile', profile);
    document.querySelector('#greeting-name').textContent = profile.nickname;
    document.querySelector('#composer-avatar').textContent = profile.nickname.slice(0,1).toUpperCase();
    document.querySelector('#signup-open').innerHTML = 'Mi perfil <span aria-hidden="true">↗</span>';
    document.querySelector('#form-feedback').textContent = 'Perfil guardado en este dispositivo.';
    renderProfile(); renderPeople(); dialog.close(); setView('inicio'); announce('Perfil guardado en este dispositivo. Todavía no es una cuenta online.');
  } catch { document.querySelector('#form-feedback').textContent = 'No se pudo guardar. Comprueba el espacio disponible del navegador.'; }
});
document.querySelector('#post-form').addEventListener('submit', event => {
  event.preventDefault();
  const profile = getProfile();
  if (!profile) { announce('Crea primero tu perfil para publicar.'); openProfile(); return; }
  const text = document.querySelector('#post-text').value.trim(); if (!text) return;
  try {
    const posts = getPosts(); posts.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), nickname: profile.nickname, text, createdAt: new Date().toISOString(), likes: [] });
    save('manual-demo-posts', posts); event.currentTarget.reset(); renderPosts(); announce('Publicación guardada en tu feed local.');
  } catch { announce('No se pudo guardar la publicación en este navegador.'); }
});
document.querySelectorAll('.app-tab').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('[data-app-nav]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); setView(link.dataset.appNav); }));
document.querySelectorAll('[data-landing-nav]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); setView('acerca'); document.querySelector('#como-funciona').scrollIntoView({ behavior: 'smooth' }); }));
document.querySelector('[data-preview-connect]')?.addEventListener('click', () => { setView('perfil'); renderProfile(); });
document.querySelectorAll('[data-connect]').forEach(button => button.addEventListener('click', () => {
  const requests = new Set(getRequests());
  requests.has(button.dataset.connect) ? requests.delete(button.dataset.connect) : requests.add(button.dataset.connect);
  save('manual-demo-requests', [...requests]); renderRequests(); renderPeople();
  announce('Solicitud de prueba guardada en este navegador; no se envió a una persona real.');
}));
document.querySelector('#mobile-menu').addEventListener('click', event => {
  const nav = document.querySelector('.desktop-nav'); const open = nav.classList.toggle('open');
  event.currentTarget.setAttribute('aria-expanded', String(open)); event.currentTarget.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
});
document.querySelectorAll('.desktop-nav a').forEach(link => link.addEventListener('click', () => {
  document.querySelector('.desktop-nav').classList.remove('open'); document.querySelector('#mobile-menu').setAttribute('aria-expanded', 'false');
}));
document.querySelectorAll('[data-chip]').forEach(chip => chip.addEventListener('click', () => {
  chip.classList.toggle('selected'); chip.setAttribute('aria-pressed', String(chip.classList.contains('selected')));
}));
document.querySelector('#filter-toggle').addEventListener('click', event => {
  const button = event.currentTarget; const active = button.classList.toggle('active');
  button.setAttribute('aria-pressed', String(active));
  const cards = [...document.querySelectorAll('.person-card')];
  cards.sort((a,b) => Number(b.querySelector('.person-match b').textContent) - Number(a.querySelector('.person-match b').textContent) * (active ? 1 : -1));
  cards.forEach(card => document.querySelector('.people-panel').insertBefore(card, document.querySelector('.demo-disclaimer')));
  button.querySelector('span').textContent = active ? 'Más coincidencias' : 'Afinidades';
});

const initialProfile = getProfile();
if (initialProfile?.nickname) {
  document.querySelector('#greeting-name').textContent = initialProfile.nickname;
  document.querySelector('#composer-avatar').textContent = initialProfile.nickname.slice(0,1).toUpperCase();
  document.querySelector('#signup-open').innerHTML = 'Mi perfil <span aria-hidden="true">↗</span>';
}
renderPosts(); renderPeople(); renderRequests();
if (location.hash === '#como-funciona') setView('acerca');

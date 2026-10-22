(() => {
  const sidebar = document.querySelector('#sidebar');
  const menuButton = document.querySelector('#menu');
  const navLinks = [...document.querySelectorAll('.nav-link')];
  const scrim = document.createElement('button');
  scrim.className = 'menu-scrim';
  scrim.type = 'button';
  scrim.setAttribute('aria-label', 'Cerrar menú');
  scrim.hidden = true;
  document.body.append(scrim);

  function closeMenu() {
    sidebar.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir menú');
    scrim.hidden = true;
  }

  menuButton.addEventListener('click', () => {
    const opening = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', opening);
    menuButton.setAttribute('aria-expanded', String(opening));
    menuButton.setAttribute('aria-label', opening ? 'Cerrar menú' : 'Abrir menú');
    scrim.hidden = !opening;
  });
  scrim.addEventListener('click', closeMenu);
  navLinks.forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });

  const filters = [...document.querySelectorAll('.filter')];
  const cards = [...document.querySelectorAll('.work-card')];
  filters.forEach(button => button.addEventListener('click', () => {
    const selected = button.dataset.filter;
    filters.forEach(filter => {
      const active = filter === button;
      filter.classList.toggle('active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    cards.forEach(card => {
      const matches = selected === 'all' || card.dataset.style.split(/\s+/).includes(selected);
      card.hidden = !matches;
    });
  }));

  const sections = [...document.querySelectorAll('#inicio, #estilos, #proceso, #cita')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const current = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!current) return;
      const target = current.target.id === 'inicio' ? '#inicio' : `#${current.target.id}`;
      navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === target));
    }, { rootMargin: '-20% 0px -65% 0px', threshold: [0, .1, .25] });
    sections.forEach(section => observer.observe(section));
  }

  const form = document.querySelector('#booking-form');
  const result = document.querySelector('#form-result');
  const message = document.querySelector('#form-message');
  const copyButton = document.querySelector('#copy-request');
  let requestText = '';
  let toastTimer;

  function toast(text) {
    let element = document.querySelector('.toast');
    if (!element) {
      element = document.createElement('div');
      element.className = 'toast';
      element.setAttribute('role', 'status');
      document.body.append(element);
    }
    element.textContent = text;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 2200);
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    requestText = [
      'Consulta para Inksomnia',
      `Nombre: ${data.get('name')}`,
      `Email: ${data.get('email')}`,
      `Estilo: ${data.get('style')}`,
      `Zona del cuerpo: ${data.get('placement') || 'Por definir'}`,
      `Idea: ${data.get('idea') || 'Por comentar'}`
    ].join('\n');
    result.hidden = false;
    message.textContent = 'Aún no se ha enviado. Copia el resumen para compartirlo con el estudio.';
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  copyButton.addEventListener('click', async () => {
    if (!requestText) return;
    try {
      await navigator.clipboard.writeText(requestText);
      toast('Resumen copiado. No se ha enviado.');
    } catch {
      const temporary = document.createElement('textarea');
      temporary.value = requestText;
      temporary.setAttribute('readonly', '');
      temporary.style.position = 'fixed';
      temporary.style.opacity = '0';
      document.body.append(temporary);
      temporary.select();
      const copied = document.execCommand('copy');
      temporary.remove();
      toast(copied ? 'Resumen copiado. No se ha enviado.' : 'No se pudo copiar; selecciona y copia el resumen manualmente.');
    }
  });
})();

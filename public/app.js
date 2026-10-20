'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const toastNode = $('#toast');
let toastTimer;
const activity = [];
let pendingWav = null;

function toast(message) {
  toastNode.textContent = message;
  toastNode.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('show'), 3200);
}

const pages = {
  youtube: {title: 'Prepara tu audio<br>a tu manera.', subtitle: 'Convierte, analiza y pule tus archivos de audio desde un solo lugar.', crumb: 'Audio a WAV'},
  analyzer: {title: 'Conoce tu pista<br>por dentro.', subtitle: 'Estima la tonalidad y el tempo de cualquier archivo de audio.', crumb: 'Key & BPM'},
  mastering: {title: 'Dale el acabado<br>a tu mezcla.', subtitle: 'Aplica un tratamiento final y descarga el resultado procesado.', crumb: 'Mastering Studio'}
};
function showPage(page) {
  if (!pages[page]) return;
  $$('[data-page]').forEach((button) => {
    const active = button.dataset.page === page;
    button.classList.toggle('active', active);
    if (button.hasAttribute('role')) button.setAttribute('aria-selected', String(active));
  });
  $$('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === `panel-${page}`));
  $('#title').innerHTML = pages[page].title;
  $('#subtitle').textContent = pages[page].subtitle;
  $('#crumb').textContent = pages[page].crumb;
  $('#sidebar').classList.remove('open');
}
$$('[data-page]').forEach((button) => button.addEventListener('click', () => showPage(button.dataset.page)));
$('#menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#privacy-info').addEventListener('click', () => toast('Los archivos permanecen en esta pestaña; no se cargan a ningún servidor.'));
$('#notifications').addEventListener('click', () => toast('No hay tareas en segundo plano.'));

function addActivity(filename, action) {
  activity.unshift({filename, action});
  activity.splice(5);
  $('#activity-count').textContent = `${activity.length} ${activity.length === 1 ? 'archivo' : 'archivos'}`;
  $('#activity-list').innerHTML = activity.map((item) => `<li><span class="activity-check" aria-hidden="true">✓</span><span>${escapeHtml(item.filename)} · ${item.action}</span></li>`).join('');
}
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function safeBaseName(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 90) || 'audio';
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'tamaño desconocido';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024, unit = units[0];
  for (let i = 1; value >= 1024 && i < units.length; i++) { value /= 1024; unit = units[i]; }
  return `${value.toFixed(1)} ${unit}`;
}
function formatDuration(seconds) {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
function encodeWav(buffer, sampleRate, channels) {
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const view = new DataView(new ArrayBuffer(44 + dataSize));
  const writeText = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  writeText(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeText(8, 'WAVE');
  writeText(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); writeText(36, 'data'); view.setUint32(40, dataSize, true);
  const sourceChannels = Array.from({length: buffer.numberOfChannels}, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      let sample;
      if (channels === 1 && sourceChannels.length > 1) {
        sample = sourceChannels.reduce((sum, data) => sum + data[frame], 0) / sourceChannels.length;
      } else {
        sample = sourceChannels[Math.min(channel, sourceChannels.length - 1)][frame];
      }
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([view], {type: 'audio/wav'});
}
async function decodeFile(file) {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) throw new Error('Este navegador no dispone de Web Audio. Prueba con Chrome, Edge o Firefox actualizado.');
  const context = new Context();
  try {
    return await context.decodeAudioData(await file.arrayBuffer());
  } finally {
    await context.close();
  }
}
async function resample(buffer, sampleRate) {
  if (buffer.sampleRate === sampleRate) return buffer;
  const channels = Math.min(2, buffer.numberOfChannels);
  const frames = Math.ceil(buffer.duration * sampleRate);
  const offline = new OfflineAudioContext(channels, frames, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  return offline.startRendering();
}
function setBusy(button, busy, text) {
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
  if (text) button.textContent = text;
}

const picked = {};
function setupPicker(id, buttonId, emptyLabel, selectedLabel, handler) {
  const input = $(`#${id}`);
  const drop = input.closest('.dropzone');
  const name = $(`#filename${id.slice(-1)}`);
  const button = $(`#${buttonId}`);
  picked[id] = null;
  function acceptFile(file) {
    if (!file) return;
    const audioExtension = /\.(wav|mp3|flac|m4a|aac|ogg|opus|aiff?|caf|webm)$/i.test(file.name);
    if (!file.type.startsWith('audio/') && !audioExtension) {
      picked[id] = null;
      input.value = '';
      name.textContent = 'Elige un archivo de audio compatible.';
      button.textContent = emptyLabel;
      toast('Elige un archivo de audio compatible con tu navegador.');
      return;
    }
    if (file.size > 300 * 1024 * 1024) {
      picked[id] = null;
      input.value = '';
      name.textContent = 'El archivo supera el límite de 300 MB.';
      button.textContent = emptyLabel;
      toast('El archivo supera el límite de 300 MB.');
      return;
    }
    picked[id] = file;
    name.textContent = file.name;
    button.textContent = selectedLabel;
    button.disabled = false;
    if (id === 'file1') {
      pendingWav = null;
      $('#convert-result').hidden = true;
      $('#convert-progress').hidden = true;
      $('#convert-error').hidden = true;
    } else if (id === 'file2') {
      $('#analysis-progress').hidden = true;
      $('#analysis-progress').classList.remove('progress-message--error');
      $('#analysis-progress .spinner').hidden = false;
      $('#results').style.display = 'none';
    }
  }
  input.addEventListener('change', () => acceptFile(input.files[0]));
  drop.addEventListener('keydown', (event) => {
    if (event.target === drop && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); input.click();
    }
  });
  drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (event) => {
    event.preventDefault(); drop.classList.remove('drag');
    const file = event.dataTransfer.files[0];
    if (!file) return;
    try { input.files = event.dataTransfer.files; } catch (_) { /* Use the retained File reference if assignment is restricted. */ }
    acceptFile(file);
  });
  button.addEventListener('click', async () => {
    const file = picked[id] || input.files[0];
    if (!file) { input.click(); return; }
    await handler(file, button);
  });
  button.textContent = emptyLabel;
}

setupPicker('file1', 'convert', 'Elegir archivo de audio  →', 'Convertir a WAV  →', async (file, button) => {
  try {
    pendingWav = null;
    $('#convert-error').hidden = true;
    $('#convert-result').hidden = true;
    $('#convert-progress').hidden = false;
    $('#convert-progress-text').textContent = 'Leyendo y decodificando el archivo…';
    setBusy(button, true, 'Preparando el WAV…');
    const decoded = await decodeFile(file);
    $('#convert-progress-text').textContent = 'Convirtiendo y preparando el archivo WAV…';
    const rate = Number($('#quality').value);
    const output = await resample(decoded, rate);
    const channels = Number($('#channels').value);
    const wav = encodeWav(output, rate, channels);
    if (!wav.size) throw new Error('El WAV resultante está vacío; el archivo de origen no se pudo procesar.');
    const filename = `${safeBaseName(file.name)}-${rate / 1000}kHz.wav`;
    pendingWav = {blob: wav, filename};
    $('#wav-details').textContent = `${filename} · ${formatDuration(output.duration)} · ${rate.toLocaleString('es-ES')} Hz · ${channels === 1 ? 'mono' : 'estéreo'} · ${formatBytes(wav.size)}`;
    $('#convert-result').hidden = false;
    addActivity(file.name, 'WAV exportado');
    toast('El archivo WAV está listo para descargar.');
  } catch (error) {
    const message = error.message || 'No se pudo convertir el archivo. Prueba con WAV o MP3.';
    console.error(error);
    $('#convert-error').textContent = message;
    $('#convert-error').hidden = false;
    toast(message);
  } finally {
    $('#convert-progress').hidden = true;
    setBusy(button, false, 'Convertir a WAV  →');
  }
});
$('#download-wav').addEventListener('click', () => {
  if (!pendingWav) { toast('Primero convierte un archivo de audio.'); return; }
  downloadBlob(pendingWav.blob, pendingWav.filename);
  toast('Descarga iniciada.');
});
$('#convert-another').addEventListener('click', () => {
  pendingWav = null;
  picked.file1 = null;
  $('#file1').value = '';
  $('#filename1').textContent = 'Los archivos no se suben a internet.';
  $('#convert').textContent = 'Elegir archivo de audio  →';
  $('#convert-result').hidden = true;
  $('#file1').click();
});

const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
setupPicker('file2', 'analyze', 'Elegir audio para analizar  →', 'Analizar Key y BPM  →', async (file, button) => {
  try {
    $('#analysis-progress').classList.remove('progress-message--error');
    $('#analysis-progress .spinner').hidden = false;
    $('#analysis-progress-text').textContent = 'Analizando espectro y pulsos…';
    $('#analysis-progress').hidden = false;
    setBusy(button, true, 'Analizando audio…');
    const buffer = await decodeFile(file);
    if (!window.BlooDyAudioAnalysis) throw new Error('No se pudo cargar el analizador. Recarga la página e inténtalo otra vez.');
    const tempo = window.BlooDyAudioAnalysis.analyzeTempo(buffer);
    const key = window.BlooDyAudioAnalysis.analyzeKey(buffer);
    if (!tempo.bpm || !Number.isFinite(tempo.bpm)) throw new Error('No se detectó un pulso claro. Prueba con una pista más rítmica.');
    const minor = key.mode === 1;
    const relative = noteNames[(key.root + (minor ? 3 : 9)) % 12];
    $('#keyval').textContent = `${noteNames[key.root]} ${minor ? 'menor' : 'mayor'}`;
    const keyQuality = key.confidence < 0.2 || key.margin < 0.015 ? 'Tonalidad poco definida' : 'Estimación espectral';
    $('#relative-key').textContent = `Relativa ${minor ? 'mayor' : 'menor'}: ${relative} · ${keyQuality}`;
    $('#bpmval').innerHTML = `${tempo.bpm} <small>BPM</small>`;
    $('#bpm-note').textContent = tempo.score < 0.12 ? 'Pulso poco definido; resultado aproximado' : `Pulsos por minuto · ${Math.round(tempo.analyzedSeconds)} s analizados`;
    $('#results').style.display = 'grid';
    $('#analysis-progress').hidden = true;
    addActivity(file.name, 'Key/BPM analizados');
    toast('Análisis terminado. Los valores son estimaciones.');
  } catch (error) {
    const message = error.message || 'No se pudo analizar el audio. Prueba con WAV o MP3.';
    console.error(error);
    $('#analysis-progress').classList.add('progress-message--error');
    $('#analysis-progress .spinner').hidden = true;
    $('#analysis-progress-text').textContent = message;
    $('#analysis-progress').hidden = false;
    toast(message);
  } finally { setBusy(button, false, 'Analizar Key y BPM  →'); }
});

async function masterAudio(file, preset) {
  const input = await decodeFile(file);
  const sampleRate = 44100;
  const channels = Math.min(2, input.numberOfChannels);
  const frames = Math.ceil(input.duration * sampleRate);
  const offline = new OfflineAudioContext(channels, frames, sampleRate);
  const source = offline.createBufferSource(); source.buffer = input;
  const low = offline.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 120;
  const high = offline.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 9000;
  const compressor = offline.createDynamicsCompressor();
  const settings = {
    balanced: {low: 0.4, high: 0.8, threshold: -13, ratio: 2.2},
    warm: {low: 1.2, high: -0.2, threshold: -14, ratio: 2.0},
    punchy: {low: 0.2, high: 1.1, threshold: -17, ratio: 3.4},
    airy: {low: -0.3, high: 1.7, threshold: -12, ratio: 1.8}
  }[preset] || {low: 0.4, high: 0.8, threshold: -13, ratio: 2.2};
  low.gain.value = settings.low; high.gain.value = settings.high;
  compressor.threshold.value = settings.threshold; compressor.knee.value = 12;
  compressor.ratio.value = settings.ratio; compressor.attack.value = 0.008; compressor.release.value = 0.22;
  source.connect(low); low.connect(high); high.connect(compressor); compressor.connect(offline.destination); source.start();
  const rendered = await offline.startRendering();
  let peak = 0;
  for (let channel = 0; channel < rendered.numberOfChannels; channel++) for (const sample of rendered.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample));
  const gain = peak > 0 ? Math.min(1.4, 0.891 / peak) : 1;
  for (let channel = 0; channel < rendered.numberOfChannels; channel++) {
    const data = rendered.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
  return encodeWav(rendered, sampleRate, channels);
}
setupPicker('file3', 'master', 'Elegir mezcla para masterizar  →', 'Aplicar mastering y descargar  →', async (file, button) => {
  try {
    setBusy(button, true, 'Procesando mezcla…');
    const preset = $('input[name="style"]:checked').value;
    const wav = await masterAudio(file, preset);
    downloadBlob(wav, `${safeBaseName(file.name)}-master.wav`);
    addActivity(file.name, 'master WAV exportado');
    toast('Master local creado y descargado.');
  } catch (error) {
    console.error(error); toast(error.message || 'No se pudo procesar la mezcla. Prueba con WAV o AIFF.');
  } finally { setBusy(button, false, 'Aplicar mastering y descargar  →'); }
});

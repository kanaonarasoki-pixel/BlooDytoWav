'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const toastNode = $('#toast');
let toastTimer;
const activity = [];

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
    if (!file.type.startsWith('audio/')) {
      toast('Elige un archivo de audio compatible con tu navegador.');
      return;
    }
    if (file.size > 300 * 1024 * 1024) {
      toast('El archivo supera el límite de 300 MB.');
      return;
    }
    picked[id] = file;
    name.textContent = file.name;
    button.textContent = selectedLabel;
    button.disabled = false;
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

setupPicker('file1', 'convert', 'Elegir archivo de audio  →', 'Convertir y descargar WAV  →', async (file, button) => {
  try {
    setBusy(button, true, 'Preparando el WAV…');
    const decoded = await decodeFile(file);
    const rate = Number($('#quality').value);
    const output = await resample(decoded, rate);
    const channels = Number($('#channels').value);
    const wav = encodeWav(output, rate, channels);
    downloadBlob(wav, `${safeBaseName(file.name)}-${rate / 1000}kHz.wav`);
    addActivity(file.name, 'WAV exportado');
    toast('WAV creado y descargado.');
  } catch (error) {
    console.error(error); toast(error.message || 'No se pudo convertir el archivo. Prueba con MP3 o WAV.');
  } finally { setBusy(button, false, 'Convertir y descargar WAV  →'); }
});

const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const keyProfiles = [
  [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],
  [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]
];
function analyzeTempo(buffer) {
  const data = buffer.getChannelData(0);
  const hop = Math.max(1, Math.floor(buffer.sampleRate * 0.01));
  const maxFrames = Math.min(data.length, buffer.sampleRate * 90);
  const envelope = [];
  let previous = 0;
  for (let start = 0; start < maxFrames; start += hop) {
    const end = Math.min(start + hop, maxFrames);
    let sum = 0;
    for (let i = start; i < end; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / Math.max(1, end - start));
    envelope.push(Math.max(0, rms - previous)); previous = rms;
  }
  const average = envelope.reduce((sum, value) => sum + value, 0) / Math.max(1, envelope.length);
  for (let i = 0; i < envelope.length; i++) envelope[i] = Math.max(0, envelope[i] - average * 0.25);
  let bestBpm = 0, bestScore = -Infinity;
  for (let bpm = 60; bpm <= 180; bpm++) {
    const lag = Math.round(6000 / bpm);
    if (lag >= envelope.length) continue;
    let score = 0, a = 0, b = 0;
    for (let i = lag; i < envelope.length; i++) { score += envelope[i] * envelope[i - lag]; a += envelope[i] ** 2; b += envelope[i - lag] ** 2; }
    score /= Math.sqrt(a * b) || 1;
    if (score > bestScore) { bestScore = score; bestBpm = bpm; }
  }
  return {bpm: bestBpm, score: bestScore};
}
function analyzeKey(buffer) {
  const input = buffer.getChannelData(0);
  const maxSeconds = Math.min(buffer.duration, 5);
  const factor = Math.max(1, Math.floor(buffer.sampleRate / 11025));
  const samples = [];
  for (let i = 0, end = Math.floor(maxSeconds * buffer.sampleRate); i < end; i += factor) samples.push(input[i]);
  const rate = buffer.sampleRate / factor;
  const chroma = Array(12).fill(0);
  for (let midi = 36; midi <= 83; midi++) {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    if (frequency >= rate / 2) continue;
    const coefficient = 2 * Math.cos(2 * Math.PI * frequency / rate);
    let q1 = 0, q2 = 0;
    for (const sample of samples) { const q0 = coefficient * q1 - q2 + sample; q2 = q1; q1 = q0; }
    chroma[midi % 12] += Math.max(0, q1 * q1 + q2 * q2 - coefficient * q1 * q2);
  }
  const mean = chroma.reduce((sum, value) => sum + value, 0) / 12;
  const centered = chroma.map(value => value - mean);
  let best = {score: -Infinity, root: 0, mode: 0};
  keyProfiles.forEach((profile, mode) => {
    const profileMean = profile.reduce((sum, value) => sum + value, 0) / 12;
    const pattern = profile.map(value => value - profileMean);
    for (let root = 0; root < 12; root++) {
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < 12; i++) { const value = centered[(i + root) % 12]; dot += value * pattern[i]; normA += value * value; normB += pattern[i] * pattern[i]; }
      const score = dot / (Math.sqrt(normA * normB) || 1);
      if (score > best.score) best = {score, root, mode};
    }
  });
  return best;
}
setupPicker('file2', 'analyze', 'Elegir audio para analizar  →', 'Analizar Key y BPM  →', async (file, button) => {
  try {
    setBusy(button, true, 'Analizando audio…');
    const buffer = await decodeFile(file);
    const key = analyzeKey(buffer);
    const tempo = analyzeTempo(buffer);
    if (!tempo.bpm || !Number.isFinite(tempo.bpm)) throw new Error('No se detectó un pulso claro. Prueba con una pista más rítmica.');
    const minor = key.mode === 1;
    const relative = noteNames[(key.root + (minor ? 3 : 9)) % 12];
    $('#keyval').textContent = `${noteNames[key.root]} ${minor ? 'menor' : 'mayor'}`;
    $('#relative-key').textContent = `Relativa ${minor ? 'mayor' : 'menor'}: ${relative}`;
    $('#bpmval').innerHTML = `${tempo.bpm} <small>BPM</small>`;
    $('#bpm-note').textContent = tempo.score < 0.08 ? 'Pulso poco definido; resultado aproximado' : 'Pulsos por minuto';
    $('#results').style.display = 'grid';
    addActivity(file.name, 'Key/BPM analizados');
    toast('Análisis terminado. Los valores son estimaciones.');
  } catch (error) {
    console.error(error); toast(error.message || 'No se pudo analizar el audio. Prueba con WAV o MP3.');
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

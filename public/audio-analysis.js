(function attachAudioAnalysis(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BlooDyAudioAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAudioAnalysis() {
  'use strict';

  const keyProfiles = [
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
  ];

  function downmix(buffer, targetRate = 11025, maxSeconds = 120) {
    if (!buffer || !buffer.numberOfChannels || !buffer.sampleRate || !buffer.length) {
      throw new Error('El archivo no contiene audio que se pueda analizar.');
    }
    const factor = Math.max(1, Math.round(buffer.sampleRate / targetRate));
    const sampleRate = buffer.sampleRate / factor;
    const channels = Array.from({length: buffer.numberOfChannels}, (_, channel) => buffer.getChannelData(channel));
    const frames = Math.min(Math.ceil(buffer.length / factor), Math.floor(maxSeconds * sampleRate));
    const mono = new Float32Array(frames);
    for (let frame = 0; frame < frames; frame++) {
      const start = frame * factor;
      const end = Math.min(start + factor, buffer.length);
      let total = 0;
      for (let sourceFrame = start; sourceFrame < end; sourceFrame++) {
        for (const channel of channels) total += channel[sourceFrame] / channels.length;
      }
      mono[frame] = total / Math.max(1, end - start);
    }
    return {mono, sampleRate};
  }

  function fft(real, imag) {
    const n = real.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const angle = -2 * Math.PI / size;
      const stepReal = Math.cos(angle);
      const stepImag = Math.sin(angle);
      for (let start = 0; start < n; start += size) {
        let twiddleReal = 1;
        let twiddleImag = 0;
        const half = size >> 1;
        for (let offset = 0; offset < half; offset++) {
          const even = start + offset;
          const odd = even + half;
          const oddReal = real[odd] * twiddleReal - imag[odd] * twiddleImag;
          const oddImag = real[odd] * twiddleImag + imag[odd] * twiddleReal;
          real[odd] = real[even] - oddReal;
          imag[odd] = imag[even] - oddImag;
          real[even] += oddReal;
          imag[even] += oddImag;
          const nextReal = twiddleReal * stepReal - twiddleImag * stepImag;
          twiddleImag = twiddleReal * stepImag + twiddleImag * stepReal;
          twiddleReal = nextReal;
        }
      }
    }
  }

  function analyzeKey(buffer) {
    const {mono, sampleRate} = downmix(buffer, 11025, 120);
    if (mono.length < sampleRate * 2) throw new Error('El audio es demasiado corto para estimar la tonalidad. Usa al menos 2 segundos.');

    const frameSize = mono.length >= 8192 ? 8192 : 4096;
    const hop = frameSize >> 1;
    const window = new Float64Array(frameSize);
    for (let i = 0; i < frameSize; i++) window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (frameSize - 1));
    const real = new Float64Array(frameSize);
    const imag = new Float64Array(frameSize);
    const chroma = new Float64Array(12);
    let frameCount = 0;

    for (let start = 0; start < mono.length; start += hop) {
      real.fill(0);
      imag.fill(0);
      let frameEnergy = 0;
      for (let i = 0; i < frameSize && start + i < mono.length; i++) {
        const value = mono[start + i] * window[i];
        real[i] = value;
        frameEnergy += value * value;
      }
      if (frameEnergy < 1e-9) continue;
      fft(real, imag);
      const frameChroma = new Float64Array(12);
      for (let bin = 1; bin < frameSize / 2; bin++) {
        const frequency = bin * sampleRate / frameSize;
        if (frequency < 55 || frequency > 2200) continue;
        const midiFloat = 69 + 12 * Math.log2(frequency / 440);
        const midi = Math.round(midiFloat);
        if (midi < 36 || midi > 95) continue;
        const cents = Math.abs(midiFloat - midi) * 100;
        const tuningWeight = Math.exp(-0.5 * (cents / 45) ** 2);
        const magnitude = Math.hypot(real[bin], imag[bin]) / frameSize;
        frameChroma[midi % 12] += Math.pow(magnitude, 0.85) * tuningWeight / Math.sqrt(frequency / 110);
      }
      const frameTotal = frameChroma.reduce((sum, value) => sum + value, 0);
      if (frameTotal <= 1e-12) continue;
      for (let note = 0; note < 12; note++) chroma[note] += frameChroma[note] / frameTotal;
      frameCount++;
      if (start + frameSize >= mono.length) break;
    }
    if (!frameCount) throw new Error('No se detectaron notas estables en este audio.');
    for (let note = 0; note < 12; note++) chroma[note] /= frameCount;
    const average = chroma.reduce((sum, value) => sum + value, 0) / 12;
    const centered = chroma.map((value) => value - average);

    const candidates = [];
    keyProfiles.forEach((profile, mode) => {
      const profileMean = profile.reduce((sum, value) => sum + value, 0) / 12;
      const pattern = profile.map((value) => value - profileMean);
      for (let root = 0; root < 12; root++) {
        let dot = 0, normChroma = 0, normProfile = 0;
        for (let i = 0; i < 12; i++) {
          const value = centered[(i + root) % 12];
          dot += value * pattern[i];
          normChroma += value * value;
          normProfile += pattern[i] * pattern[i];
        }
        candidates.push({root, mode, score: dot / (Math.sqrt(normChroma * normProfile) || 1)});
      }
    });
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    return {root: best.root, mode: best.mode, confidence: best.score, margin: best.score - candidates[1].score};
  }

  function analyzeTempo(buffer) {
    const {mono, sampleRate} = downmix(buffer, 11025, 120);
    if (mono.length < sampleRate * 5) throw new Error('El audio es demasiado corto para medir el tempo con fiabilidad. Usa al menos 5 segundos.');
    const frameSize = Math.max(1, Math.round(sampleRate * 0.01));
    const envelope = new Float64Array(Math.ceil(mono.length / frameSize));
    let previousInput = 0;
    let previousHighpass = 0;
    let previousRms = 0;
    let peak = 0;
    for (let frame = 0; frame < envelope.length; frame++) {
      const start = frame * frameSize;
      const end = Math.min(start + frameSize, mono.length);
      let energy = 0;
      for (let index = start; index < end; index++) {
        const input = mono[index];
        const highpass = input - previousInput + 0.97 * previousHighpass;
        previousInput = input;
        previousHighpass = highpass;
        energy += highpass * highpass;
      }
      const rms = Math.sqrt(energy / Math.max(1, end - start));
      const onset = Math.max(0, rms - previousRms);
      envelope[frame] = onset;
      peak = Math.max(peak, onset);
      previousRms = rms;
    }
    if (peak < 1e-6) throw new Error('No se detectaron pulsos. Prueba con una pista rítmica y con suficiente volumen.');
    const average = envelope.reduce((sum, value) => sum + value, 0) / envelope.length;
    for (let i = 0; i < envelope.length; i++) envelope[i] = Math.max(0, envelope[i] - average * 0.3);
    const smooth = new Float64Array(envelope.length);
    for (let i = 0; i < envelope.length; i++) {
      smooth[i] = (envelope[i] * 2 + (envelope[i - 1] || 0) + (envelope[i + 1] || 0)) / 4;
    }
    const frameRate = sampleRate / frameSize;
    const correlationCache = new Map();
    function correlation(lag) {
      lag = Math.round(lag);
      if (lag < 1 || lag >= smooth.length) return 0;
      if (correlationCache.has(lag)) return correlationCache.get(lag);
      let dot = 0, leftPower = 0, rightPower = 0;
      for (let i = lag; i < smooth.length; i++) {
        const a = smooth[i], b = smooth[i - lag];
        dot += a * b;
        leftPower += a * a;
        rightPower += b * b;
      }
      const score = dot / (Math.sqrt(leftPower * rightPower) || 1);
      correlationCache.set(lag, score);
      return score;
    }
    function scoreAt(lag) {
      return correlation(lag) + 0.5 * correlation(lag * 2) + 0.25 * correlation(lag * 3);
    }
    const minLag = Math.max(2, Math.floor(frameRate * 60 / 220));
    const maxLag = Math.min(smooth.length - 1, Math.ceil(frameRate * 60 / 45));
    let bestLag = 0, bestScore = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      const score = scoreAt(lag);
      if (score > bestScore) { bestScore = score; bestLag = lag; }
    }
    if (!bestLag || bestScore < 0.02) throw new Error('No se detectó un pulso claro. Prueba con una pista más rítmica.');
    const left = scoreAt(bestLag - 1);
    const center = scoreAt(bestLag);
    const right = scoreAt(bestLag + 1);
    const denominator = left - 2 * center + right;
    const correction = denominator ? Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / denominator)) : 0;
    return {bpm: Math.round(60 * frameRate / (bestLag + correction)), score: Math.min(1, bestScore), analyzedSeconds: mono.length / sampleRate};
  }

  return Object.freeze({analyzeKey, analyzeTempo});
});

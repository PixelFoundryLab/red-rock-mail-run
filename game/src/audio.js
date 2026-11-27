// Red Rock Mail Run: all sound is synthesised with WebAudio — no audio files.
// An engine hum that follows the throttle, a chime for a cleared ring, a
// thud for a crash and a short fanfare for a landing. Audio starts on the
// first user gesture, as browsers require.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let windSource = null;
  let started = false;
  let muted = false;

  function ensure() {
    if (started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      // Engine: two detuned saws through a low-pass, gain follows throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 55 * 1.007;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      // Wind: looped filtered noise, louder with speed.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 900;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSource.start();
      started = true;
    } catch {
      // No audio: the game plays silent.
    }
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function setEngine(throttle, speedNorm, onGround) {
    if (!ctx || !started || muted) return;
    const t = ctx.currentTime;
    const freq = 48 + throttle * 90 + speedNorm * 30;
    engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(freq * 1.007, t, 0.08);
    engineGain.gain.setTargetAtTime(onGround ? 0.02 + throttle * 0.05 : 0.03 + throttle * 0.07, t, 0.1);
    windGain.gain.setTargetAtTime(onGround ? 0 : speedNorm * 0.05, t, 0.15);
  }

  function blip(freq, at, dur, type = 'sine', vol = 0.16) {
    if (!ctx || !started || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime + at);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + dur + 0.05);
  }

  function ring() {
    blip(660, 0, 0.25);
    blip(880, 0.09, 0.3);
    blip(1320, 0.18, 0.35);
  }

  // Mail drop: a soft low chime, two notes falling.
  function drop() {
    blip(520, 0, 0.22, 'triangle', 0.18);
    blip(392, 0.1, 0.3, 'triangle', 0.18);
  }

  function crash() {
    if (!ctx || !started || muted) return;
    const len = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    blip(70, 0, 0.5, 'sine', 0.4);
  }

  function win() {
    [523, 659, 784, 1047].forEach((f, i) => blip(f, i * 0.13, 0.4, 'triangle', 0.18));
  }

  function setMuted(value) {
    muted = value;
    if (ctx && engineGain) engineGain.gain.setTargetAtTime(value ? 0 : 0.05, ctx.currentTime, 0.05);
    if (ctx && windGain) windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  }

  return { resume, setEngine, ring, drop, crash, win, setMuted };
}

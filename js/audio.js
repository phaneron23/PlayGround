// Tiny procedural WebAudio SFX — no assets needed.
let ctx = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
function tone(freq, dur = 0.12, type = 'square', vol = 0.08, slide = 0) {
  try {
    const c = ac(); const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  } catch { /* audio unavailable */ }
}
export const sfx = {
  select() { tone(520, 0.07, 'square', 0.05); },
  order() { tone(330, 0.09, 'square', 0.06, 120); },
  sword() { tone(180, 0.08, 'sawtooth', 0.05, -80); },
  gold() { tone(880, 0.1, 'sine', 0.06, 220); tone(1320, 0.12, 'sine', 0.04); },
  wood() { tone(220, 0.09, 'triangle', 0.07, -60); },
  error() { tone(140, 0.18, 'sawtooth', 0.07); },
  train() { tone(440, 0.12, 'triangle', 0.06, 220); },
  build() { tone(150, 0.15, 'square', 0.05, 60); tone(300, 0.12, 'square', 0.04); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.08), i * 140)); },
  lose() { [400, 320, 240, 160].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.06), i * 160)); },
};
window.addEventListener('pointerdown', () => { try { ac(); } catch {} }, { once: true });

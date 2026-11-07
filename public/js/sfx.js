// Bunyi sintetik (WebAudio) — tiada fail audio diperlukan.
// Nak guna bunyi sendiri? Letak public/assets/sfx/<nama>.mp3 (item, kill, win, lose, spell, ready) — akan diguna dulu.
(function () {
  let ctx;
  const enabled = new URLSearchParams(location.search).get('sound') !== '0';
  const custom = {};

  function ac() { return (ctx ||= new (window.AudioContext || window.webkitAudioContext)()); }

  function tone(freq, dur, type = 'sine', vol = 0.2, delay = 0, slide = 0) {
    const c = ac(), t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol = 0.15, delay = 0) {
    const c = ac(), t = c.currentTime + delay;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 900; s.buffer = buf; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start(t);
  }

  const SYN = {
    item() { tone(880, .15, 'triangle', .2); tone(1320, .3, 'triangle', .18, .1); noise(.25, .06); },
    kill() { noise(.35, .2); tone(110, .5, 'sawtooth', .25, 0, -60); tone(220, .4, 'square', .1, .05); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .5, 'triangle', .2, i * .14)); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, .6, 'sawtooth', .12, i * .22)); },
    spell() { tone(660, .12, 'square', .12); tone(990, .2, 'square', .1, .1); },
    ready() { tone(1200, .1, 'sine', .2); tone(1600, .2, 'sine', .2, .12); },
    pop() { tone(500, .12, 'triangle', .15, 0, 400); },
  };

  function play(name) {
    if (!enabled) return;
    try {
      if (custom[name] !== false) {
        const a = custom[name] || new Audio(`assets/sfx/${name}.mp3`);
        custom[name] = a;
        a.currentTime = 0;
        a.play().catch(() => { custom[name] = false; SYN[name]?.(); });
        a.onerror = () => { custom[name] = false; };
        return;
      }
      SYN[name]?.();
    } catch { /* abaikan */ }
  }
  window.SFX = { play };
})();

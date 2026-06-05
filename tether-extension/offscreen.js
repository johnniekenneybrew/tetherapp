// Plays a short, pleasant chime when the focus timer completes.
// Generated with the Web Audio API so no audio asset is needed.

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "playChime") playChime();
});

function playChime() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const now = ctx.currentTime;
  // Two soft notes: a gentle "ding-dong".
  const notes = [
    { freq: 880, start: 0,    dur: 0.45 },
    { freq: 660, start: 0.18, dur: 0.55 },
  ];
  notes.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(0.25, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + dur);
  });
  // Close the context (and let the service worker tear down the doc) after playback.
  setTimeout(() => ctx.close(), 1200);
}

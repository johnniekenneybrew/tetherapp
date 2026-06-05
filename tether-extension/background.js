// Service worker — opens the side panel and runs the Focus Mode timer

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// ── Focus timer alarm ──────────────────────────────────────────
// The side panel writes the timer state to chrome.storage.local and schedules
// a `focusTimer` alarm at the end timestamp. This runs even when the panel is
// closed, so when it fires we update the persisted state and notify the user.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "focusTimer") return;

  const { focusTimer } = await chrome.storage.local.get("focusTimer");
  if (!focusTimer || !focusTimer.active || focusTimer.paused) return;

  if (focusTimer.phase === "break") {
    // Break finished → return to setup, ready for the next block.
    await chrome.storage.local.set({
      focusTimer: { ...focusTimer, active: false, ended: false, phase: "work", paused: false },
    });
    notify("Break over", "Ready for another focus block?");
  } else {
    // Work block finished → session-ended state (notify & wait).
    await chrome.storage.local.set({
      focusTimer: {
        ...focusTimer,
        active: false,
        paused: false,
        ended: true,
        pomodoros: (focusTimer.pomodoros || 0) + 1,
      },
    });
    notify("Focus block complete", "Nice work. Time for a break?");
  }

  playChime();
});

function notify(title, message) {
  chrome.notifications.create("focus-" + Date.now(), {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
    priority: 2,
  });
}

// ── Chime via offscreen document ───────────────────────────────
async function playChime() {
  try {
    const has = await chrome.offscreen.hasDocument?.();
    if (!has) {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play the focus timer completion chime.",
      });
    }
    chrome.runtime.sendMessage({ type: "playChime" });
  } catch (e) {
    console.error("chime failed", e);
  }
}

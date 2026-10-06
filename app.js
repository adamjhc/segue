"use strict";

const PHASES = [
  { id: "wind", name: "Wind down", hint: "Wrap up what you're doing. Save your place, jot a note, put things down." },
  { id: "rest", name: "Rest", hint: "Nothing to do now. Breathe, stretch, look out of a window." },
  { id: "start", name: "Start up" }, // Its hint is the suggested first step
];

const CHIMES = {
  rest: [659.25, 523.25],
  start: [523.25, 659.25, 783.99],
};

const SETTINGS_KEY = "segue.settings";
const SESSION_KEY = "segue.session";
const MIN_MINUTES = 1;
const MAX_MINUTES = 60;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function save(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, quota); the app still works without it.
  }
}

function clampMinutes(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 5;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, n));
}

const stored = load(SETTINGS_KEY) ?? {};
const settings = {
  minutes: PHASES.map((_, i) => clampMinutes(stored.minutes?.[i] ?? 5)),
  task: typeof stored.task === "string" ? stored.task : "",
  sound: stored.sound !== false,
};

// session: { minutes: number[], phase: number, endsAt: number, remaining: number | null }
// `remaining` is set only while paused.
let session = load(SESSION_KEY);
let ticker = null;

/* Views */

function show(view) {
  for (const section of $$(".view")) section.hidden = section.id !== view;
  document.body.dataset.view = view;
  if (view !== "session") {
    document.body.dataset.phase = "none";
    document.body.dataset.paused = "false";
    document.title = "segue";
  }
}

function focusHeading(view) {
  $(`#${view} h1`).focus({ preventScroll: true });
}

/* Setup */

function renderSetup() {
  $$(".phase").forEach((item, i) => {
    $("input", item).value = settings.minutes[i];
  });
  $("#task").value = settings.task;
  $("#sound").checked = settings.sound;
  renderTotal();
}

function renderTotal() {
  const total = settings.minutes.reduce((a, b) => a + b, 0);
  $("#total").textContent = `${total} minutes in total`;
}

function setMinutes(index, value) {
  settings.minutes[index] = clampMinutes(value);
  $$(".phase")[index].querySelector("input").value = settings.minutes[index];
  save(SETTINGS_KEY, settings);
  renderTotal();
}

$$(".phase").forEach((item, i) => {
  const input = $("input", item);
  input.addEventListener("change", () => setMinutes(i, input.value));
  for (const button of $$("[data-step]", item)) {
    button.addEventListener("click", () => setMinutes(i, settings.minutes[i] + Number(button.dataset.step)));
  }
});

$("#task").addEventListener("input", (event) => {
  settings.task = event.target.value.trim();
  save(SETTINGS_KEY, settings);
});

$("#sound").addEventListener("change", (event) => {
  settings.sound = event.target.checked;
  save(SETTINGS_KEY, settings);
  if (settings.sound) unlockAudio();
});

$("#begin").addEventListener("click", begin);

/* Session */

const phaseMs = (index) => session.minutes[index] * 60_000;
const remainingMs = () => session.remaining ?? session.endsAt - Date.now();

function begin() {
  unlockAudio();
  session = {
    minutes: [...settings.minutes],
    phase: 0,
    endsAt: Date.now() + settings.minutes[0] * 60_000,
    remaining: null,
    task: settings.task,
    step: suggestStep(settings.task),
  };
  save(SESSION_KEY, session);
  startSession();
  focusHeading("session");
}

function startSession() {
  show("session");
  $$(".seg").forEach((seg, i) => seg.style.setProperty("--minutes", session.minutes[i]));
  enterPhase();
  update();
  clearInterval(ticker);
  ticker = setInterval(update, 250);
  keepAwake(session.remaining == null);
}

function enterPhase() {
  const phase = PHASES[session.phase];
  document.body.dataset.phase = phase.id;
  $("#phase-name").textContent = phase.name;
  const starting = phase.id === "start";
  $("#hint").textContent = starting ? session.step : phase.hint;
  $(".step-extras").hidden = !starting;
  $("#for-task").textContent = session.task ? `To get going with “${session.task}”` : "";
  $("#for-task").hidden = !session.task;
  $$(".seg").forEach((seg, i) => {
    if (i === session.phase) seg.setAttribute("aria-current", "step");
    else seg.removeAttribute("aria-current");
  });
  renderPaused();
}

function update() {
  if (!session) return;
  let remaining = remainingMs();
  let advanced = false;

  // Catch up on any phases that ended while the tab was asleep.
  while (remaining <= 0) {
    if (session.phase === PHASES.length - 1) return finish();
    session.phase += 1;
    session.endsAt += phaseMs(session.phase);
    remaining = remainingMs();
    advanced = true;
  }

  if (advanced) {
    save(SESSION_KEY, session);
    enterPhase();
    chime(PHASES[session.phase].id);
    announce(`${PHASES[session.phase].name}. ${session.minutes[session.phase]} minutes. ${$("#hint").textContent}`);
  }

  render(remaining);
}

function render(remaining) {
  const total = phaseMs(session.phase);
  const level = Math.min(1, Math.max(0, remaining / total));
  const time = formatTime(remaining);
  const timeEl = $("#time");

  if (timeEl.textContent !== time) {
    timeEl.textContent = time;
    document.title = `${time} ${PHASES[session.phase].name} – segue`;
  }
  $(".blob").style.setProperty("--level", level);
  $$(".seg").forEach((seg, i) => {
    const progress = i < session.phase ? 1 : i === session.phase ? 1 - level : 0;
    seg.style.setProperty("--progress", progress);
  });
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function togglePause() {
  if (!session) return;
  if (session.remaining == null) {
    session.remaining = remainingMs();
    keepAwake(false);
  } else {
    session.endsAt = Date.now() + session.remaining;
    session.remaining = null;
    unlockAudio();
    keepAwake(true);
  }
  save(SESSION_KEY, session);
  renderPaused();
  update();
}

function renderPaused() {
  const paused = session.remaining != null;
  document.body.dataset.paused = String(paused);
  $("#pause").textContent = paused ? "Resume" : "Pause";
}

function skip() {
  if (!session) return;
  if (session.phase === PHASES.length - 1) return finish();
  session.phase += 1;
  if (session.remaining == null) session.endsAt = Date.now() + phaseMs(session.phase);
  else session.remaining = phaseMs(session.phase);
  save(SESSION_KEY, session);
  enterPhase();
  announce(`${PHASES[session.phase].name}. ${$("#hint").textContent}`);
  update();
}

function anotherStep() {
  if (!session) return;
  session.step = suggestStep(session.task, session.step);
  save(SESSION_KEY, session);
  $("#hint").textContent = session.step;
  announce(session.step);
}

function stopSession() {
  clearInterval(ticker);
  ticker = null;
  session = null;
  save(SESSION_KEY, null);
  keepAwake(false);
}

function finish() {
  // No chime here on purpose: by the end of start up someone may be in flow, so we finish silently.
  const task = session.task;
  stopSession();
  $("#done-note").textContent = task ? `Keep going with “${task}”.` : "Carry on with the next thing.";
  show("done");
  focusHeading("done");
}

function end() {
  stopSession();
  show("setup");
  focusHeading("setup");
}

$("#pause").addEventListener("click", togglePause);
$("#skip").addEventListener("click", skip);
$("#another").addEventListener("click", anotherStep);
$("#end").addEventListener("click", end);
$("#again").addEventListener("click", () => {
  show("setup");
  focusHeading("setup");
});

document.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || !session) return;
  if (event.target.closest("button, input")) return;
  event.preventDefault();
  togglePause();
});

/* Announcements, sound and screen wake */

function announce(message) {
  $("#announce").textContent = message;
}

let audio = null;

function unlockAudio() {
  if (!settings.sound) return;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  audio ??= new Context();
  if (audio.state === "suspended") audio.resume();
}

function chime(name) {
  if (!settings.sound || !audio) return;
  const start = audio.currentTime + 0.05;
  CHIMES[name].forEach((frequency, i) => {
    const t = start + i * 0.22;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 1.9);
  });
}

// Browsers only allow audio after a user gesture, e.g. after a reload mid-session.
document.addEventListener("pointerdown", unlockAudio, { once: true });

let wakeLock = null;

async function keepAwake(on) {
  try {
    if (on && !wakeLock && "wakeLock" in navigator && document.visibilityState === "visible") {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    // Wake lock is a nice-to-have; ignore refusals.
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !session) return;
  update();
  if (session && session.remaining == null) keepAwake(true);
});

/* Start */

renderSetup();

if (session && Array.isArray(session.minutes) && PHASES[session.phase]) {
  session.step ??= suggestStep(session.task);
  startSession();
} else {
  session = null;
  save(SESSION_KEY, null);
  show("setup");
}

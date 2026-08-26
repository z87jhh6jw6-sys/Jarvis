// Minuteur de repos global — repris du carnet de charges existant.
// Écran maintenu allumé pendant le décompte. Fin de repos SILENCIEUSE :
// vibration + bascule visuelle franche, aucun son (usage en salle).
// Les API utilisées sont optionnelles et échouent sans casser le minuteur.

import { formatDuration } from "../utils.js";

let el, labelEl, clockEl, barEl, playEl;
let seconds = 0;
let total = 0;
let intervalId = null;
let running = false;
let wakeLock = null;
// Base temps absolue : un setInterval est mis en pause par iOS quand l'écran
// se verrouille, donc on recalcule le restant depuis l'horloge à chaque tick.
let endAt = 0;

export function initTimer() {
  el = document.getElementById("timer");
  if (!el) return;
  labelEl = document.getElementById("timerLabel");
  clockEl = document.getElementById("timerClock");
  barEl = document.getElementById("timerBar");
  playEl = document.getElementById("timerPlay");

  playEl.addEventListener("click", () => {
    if (running) {
      pause();
    } else {
      if (seconds <= 0) {
        seconds = 90;
        total = 90;
        labelEl.textContent = "Repos libre";
      }
      start();
    }
  });

  document.getElementById("timerPlus").addEventListener("click", () => {
    seconds += 15;
    total = Math.max(total, seconds);
    if (running) endAt = Date.now() + seconds * 1000;
    paint();
  });

  document.getElementById("timerMinus").addEventListener("click", () => {
    seconds = Math.max(0, seconds - 15);
    if (seconds === 0) stop();
    else if (running) endAt = Date.now() + seconds * 1000;
    paint();
  });

  document.getElementById("timerClose").addEventListener("click", close);

  // Au retour d'arrière-plan, resynchronise et rattrape la fin manquée.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && running) tick();
  });

  paint();
}

export function startRest(restSeconds, label, prefix = "Repos") {
  if (!el || !restSeconds) return;
  seconds = restSeconds;
  total = restSeconds;
  labelEl.textContent = `${prefix} · ${label}`;
  el.dataset.open = "true";
  start();
}

function start() {
  stopInterval();
  if (seconds <= 0) return paint();
  running = true;
  endAt = Date.now() + seconds * 1000;
  intervalId = setInterval(tick, 250);
  requestWakeLock();
  paint();
}

function pause() {
  stopInterval();
  running = false;
  releaseWakeLock();
  paint();
}

function stop() {
  stopInterval();
  running = false;
  releaseWakeLock();
}

function stopInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function close() {
  stop();
  seconds = 0;
  total = 0;
  el.dataset.open = "false";
  labelEl.textContent = "Minuteur de repos";
  paint();
}

function tick() {
  const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
  const wasPositive = seconds > 0;
  seconds = remaining;
  if (remaining === 0 && wasPositive) {
    stop();
    buzz();
  }
  paint();
}

function paint() {
  if (!el) return;
  const s = Math.max(0, seconds);
  const done = Boolean(total) && s === 0;
  // Sans son, l'affichage est le seul repère si la vibration passe inaperçue :
  // le compteur cède la place à un message explicite.
  clockEl.textContent = done ? "GO" : formatDuration(s);
  barEl.style.width = total ? (s / total) * 100 + "%" : "0%";
  playEl.textContent = running ? "❚❚" : "▶";
  el.dataset.state = done ? "done" : s > 0 && s <= 5 ? "warn" : running ? "run" : "idle";
  if (done) labelEl.textContent = "Repos terminé";
}

// --- Écran et vibration ----------------------------------------------------
// Fin de repos SILENCIEUSE, par choix : vibration + signal visuel franc,
// aucun son. L'app s'utilise dans une salle fréquentée.

function requestWakeLock() {
  try {
    if (!wakeLock && navigator.wakeLock) {
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          wakeLock = lock;
          lock.addEventListener?.("release", () => {
            wakeLock = null;
          });
        })
        .catch(() => {});
    }
  } catch (err) {
    /* non supporté : sans conséquence */
  }
}

function releaseWakeLock() {
  try {
    wakeLock?.release();
  } catch (err) {
    /* ignore */
  }
  wakeLock = null;
}

function buzz() {
  try {
    // Motif long/court/long : reconnaissable dans la poche, sans son.
    navigator.vibrate?.([400, 120, 200, 120, 400]);
  } catch (err) {
    /* non supporté : le signal visuel prend le relais */
  }
}

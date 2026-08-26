// Store central. Un seul document en mémoire, muté via update(),
// persisté automatiquement (écriture groupée) après chaque changement.

import { initStorage, saveData } from "./storage.js";
import { debounce } from "./utils.js";

let data = null;
let ready = null;
const listeners = new Set();
const errorListeners = new Set();

const flush = debounce((snapshot) => {
  saveData(snapshot).catch((err) => {
    console.error("Échec de l'enregistrement", err);
    errorListeners.forEach((fn) => fn(err));
  });
}, 300);

export function init() {
  if (!ready) {
    ready = initStorage().then((loaded) => {
      data = loaded;
      notify();
      return data;
    });
  }
  return ready;
}

export function getState() {
  return data;
}

// Remplace tout le document (import, changement de fichier lié).
export function replaceState(next, { persist = true } = {}) {
  data = next;
  notify();
  if (persist) flush(data);
}

// updater(data) mute en place ; on renotifie ensuite.
export function update(updater) {
  if (!data) return;
  updater(data);
  data = { ...data };
  notify();
  flush(data);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function onSaveError(fn) {
  errorListeners.add(fn);
  return () => errorListeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(data);
    } catch (err) {
      console.error("Erreur dans un abonné au state", err);
    }
  });
}

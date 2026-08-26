// Couche de stockage : UN seul document JSON (jarvis-data.json).
//
// Deux backends, choisis automatiquement :
//
//   "fichier"  File System Access API (Chrome / Edge, desktop).
//              L'utilisateur désigne un vrai fichier une fois — typiquement
//              dans un dossier iCloud Drive. On garde le handle en IndexedDB
//              et on écrit dedans à chaque modification. Rien n'est spécifique
//              à iCloud : c'est un dossier comme un autre, macOS s'occupe seul
//              de la synchronisation.
//
//   "local"    IndexedDB (Safari macOS et iOS, qui n'implémentent pas cette
//              API, même en PWA installée). Les données restent dans l'app.
//              La synchro vers iCloud Drive est manuelle : bouton Exporter /
//              Importer dans Réglages.
//
// Le reste de l'app ignore lequel est actif.

import { idbGet, idbSet, idbDelete } from "./idb.js";
import { normalize, emptyData } from "./schema.js";

const FILE_NAME = "jarvis-data.json";
const KEY_HANDLE = "fileHandle";
const KEY_DATA = "data";

export const supportsFileAccess =
  typeof window !== "undefined" &&
  typeof window.showSaveFilePicker === "function" &&
  typeof window.showOpenFilePicker === "function";

let handle = null;
let backend = "local";
let lastSyncedAt = null;

export function getBackend() {
  return backend;
}

export function getFileName() {
  return handle?.name || FILE_NAME;
}

export function getLastSyncedAt() {
  return lastSyncedAt;
}

// --- Démarrage -------------------------------------------------------------

export async function initStorage() {
  if (supportsFileAccess) {
    try {
      const saved = await idbGet(KEY_HANDLE);
      if (saved && (await hasPermission(saved))) {
        handle = saved;
        backend = "fichier";
        const data = await readHandle(handle);
        lastSyncedAt = new Date().toISOString();
        return data;
      }
    } catch (err) {
      // Handle périmé ou permission révoquée : on retombe sur le local
      // plutôt que de bloquer le démarrage.
      console.warn("Handle de fichier inutilisable, bascule en stockage local.", err);
    }
  }
  backend = "local";
  const stored = await idbGet(KEY_DATA);
  return stored ? normalize(stored) : emptyData();
}

async function hasPermission(h, request = false) {
  const opts = { mode: "readwrite" };
  if ((await h.queryPermission(opts)) === "granted") return true;
  if (request && (await h.requestPermission(opts)) === "granted") return true;
  return false;
}

// --- Lier un fichier réel (Chrome / Edge) ---------------------------------

export async function linkNewFile(currentData) {
  assertFileAccess();
  const h = await window.showSaveFilePicker({
    suggestedName: FILE_NAME,
    types: [{ description: "Données Jarvis", accept: { "application/json": [".json"] } }],
  });
  if (!(await hasPermission(h, true))) throw new Error("Permission d'écriture refusée.");
  const data = currentData || emptyData();
  await writeHandle(h, data);
  handle = h;
  backend = "fichier";
  lastSyncedAt = new Date().toISOString();
  await idbSet(KEY_HANDLE, h);
  return data;
}

export async function linkExistingFile() {
  assertFileAccess();
  const [h] = await window.showOpenFilePicker({
    types: [{ description: "Données Jarvis", accept: { "application/json": [".json"] } }],
    multiple: false,
  });
  if (!(await hasPermission(h, true))) throw new Error("Permission d'écriture refusée.");
  const data = await readHandle(h);
  handle = h;
  backend = "fichier";
  lastSyncedAt = new Date().toISOString();
  await idbSet(KEY_HANDLE, h);
  return data;
}

export async function unlinkFile() {
  handle = null;
  backend = "local";
  lastSyncedAt = null;
  await idbDelete(KEY_HANDLE);
}

function assertFileAccess() {
  if (!supportsFileAccess) {
    throw new Error(
      "Ce navigateur ne permet pas de lier un fichier. Utilise Exporter / Importer."
    );
  }
}

async function readHandle(h) {
  const file = await h.getFile();
  const text = await file.text();
  if (!text.trim()) return emptyData();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    // On refuse d'écraser en silence un fichier qu'on ne sait pas relire :
    // mieux vaut une erreur explicite qu'une perte de données.
    throw new Error(
      "Le fichier lié n'est pas un JSON valide. Corrige-le ou choisis un autre fichier avant de continuer."
    );
  }
  return normalize(parsed);
}

async function writeHandle(h, data) {
  const w = await h.createWritable();
  await w.write(JSON.stringify(data, null, 2));
  await w.close();
}

// --- Écriture --------------------------------------------------------------

export async function saveData(data) {
  data.updatedAt = new Date().toISOString();
  if (backend === "fichier" && handle) {
    await writeHandle(handle, data);
    lastSyncedAt = data.updatedAt;
  } else {
    await idbSet(KEY_DATA, data);
  }
  return data;
}

// Relit le fichier lié (utile si modifié depuis un autre appareil via iCloud).
export async function reloadFromFile() {
  if (backend !== "fichier" || !handle) {
    throw new Error("Aucun fichier lié.");
  }
  const data = await readHandle(handle);
  lastSyncedAt = new Date().toISOString();
  return data;
}

// --- Export / import manuel (Safari, ou sauvegarde ponctuelle) -------------

export function exportToFile(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = FILE_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importFromFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error("Fichier invalide : ce n'est pas du JSON.");
  }
  return normalize(parsed);
}

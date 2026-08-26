// Helpers partagés. Aucune dépendance.

export function uid(prefix = "") {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function todayISO() {
  return toISO(new Date());
}

export function toISO(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function monthOf(iso) {
  return String(iso || "").slice(0, 7);
}

export function currentMonth() {
  return todayISO().slice(0, 7);
}

export function formatDate(iso, opts = {}) {
  if (!isValidDateISO(iso)) return String(iso || "");
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("fr-FR", {
    weekday: opts.weekday ? "long" : undefined,
    day: "numeric",
    month: opts.longMonth ? "long" : "short",
    year: opts.year ? "numeric" : undefined,
  });
}

export function formatMonth(ym) {
  if (!/^\d{4}-\d{2}$/.test(String(ym || ""))) return String(ym || "");
  const d = new Date(ym + "-01T12:00:00");
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function formatMoney(amount, opts = {}) {
  const n = Number(amount) || 0;
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: opts.cents === false ? 0 : 2,
    maximumFractionDigits: opts.cents === false ? 0 : 2,
  });
}

export function formatWeight(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(1).replace(".", ",");
}

export function debounce(fn, wait = 300) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function lastNDates(n, from = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from);
    d.setDate(d.getDate() - i);
    out.push(toISO(d));
  }
  return out;
}

export function sum(arr, fn) {
  return arr.reduce((acc, x) => acc + (fn ? Number(fn(x)) || 0 : Number(x) || 0), 0);
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

// --- Validation -----------------------------------------------------------
// Le fichier JSON peut être édité à la main ou corrompu par une synchro :
// rien de ce qui en sort n'est considéré comme fiable a priori.

export function isNonEmptyString(v, maxLen = 200) {
  return typeof v === "string" && v.trim().length > 0 && v.trim().length <= maxLen;
}

export function isValidDateISO(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T12:00:00");
  return !Number.isNaN(d.getTime()) && toISO(d) === v;
}

// Accepte "12,5" comme "12.5" (clavier français).
export function parseNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const cleaned = v.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parsePositive(v) {
  const n = parseNumber(v);
  return n !== null && n > 0 ? n : null;
}

export function clampString(v, maxLen = 200) {
  return String(v ?? "").trim().slice(0, maxLen);
}

// Échappement avant toute insertion dans innerHTML.
export function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

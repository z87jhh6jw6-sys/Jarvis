// Anneau de progression SVG — zéro dépendance.
// Piste anthracite ; remplissage à l'accent de la page, ou à la couleur
// passée via opts.color (le tableau de bord donne à chaque anneau la
// couleur de SON module : ambre sport, vert budget, violet habitudes).
// Bascule en rouge critique uniquement si opts.alert.

import { esc } from "../utils.js";

export function ring(pct, opts = {}) {
  const size = opts.size || 86;
  const stroke = opts.stroke || 7;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, Number(pct) || 0));
  const offset = circ * (1 - clamped);
  const value = opts.value !== undefined ? String(opts.value) : Math.round(clamped * 100) + "";
  const unit = opts.unit !== undefined ? String(opts.unit) : "%";
  const valueSize = value.length > 4 ? size * 0.2 : size * 0.26;
  // opts.color attendu comme variable CSS (ex. "var(--brand-sport)") ou hex.
  // Ignoré en état d'alerte : le rouge critique garde la priorité.
  const colorStyle = !opts.alert && opts.color ? ` style="--ring-color:${esc(opts.color)}"` : "";

  const svg = `
    <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"${colorStyle}
      role="img" aria-label="${esc(opts.label || "")} : ${esc(value)}${esc(unit)}">
      <circle class="ring-track" cx="${c}" cy="${c}" r="${r}"
        fill="none" stroke-width="${stroke}"></circle>
      <circle class="ring-fill ${opts.alert ? "alert" : ""}" cx="${c}" cy="${c}" r="${r}"
        fill="none" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
        transform="rotate(-90 ${c} ${c})"></circle>
      <text class="ring-value" x="${c}" y="${c + (unit ? 0 : valueSize * 0.34)}"
        text-anchor="middle" ${unit ? `dominant-baseline="auto" dy="2"` : `dominant-baseline="middle"`}
        font-size="${valueSize.toFixed(0)}">${esc(value)}</text>
      ${unit ? `<text class="ring-unit" x="${c}" y="${c + size * 0.19}" text-anchor="middle">${esc(unit)}</text>` : ""}
    </svg>`;

  if (!opts.label) return svg;
  return `<div class="ring-wrap">${svg}<span class="ring-label">${esc(opts.label)}</span></div>`;
}

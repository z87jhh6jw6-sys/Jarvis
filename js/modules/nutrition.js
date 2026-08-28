import { getState, update, subscribe } from "../state.js";
import { effectiveTargets, isProfileComplete } from "../profile.js";
import {
  uid,
  todayISO,
  formatDate,
  lastNDates,
  esc,
  parseNumber,
  clampString,
  isNonEmptyString,
  sum,
} from "../utils.js";

const GLASS_ML = 250;

export function render(container) {
  const wrap = document.createElement("div");
  container.appendChild(wrap);
  const unsub = subscribe(draw);
  draw();
  return unsub;

  function draw() {
    const data = getState();
    if (!data) return;
    const today = todayISO();
    const t = effectiveTargets(data.profile);

    const meals = data.nutrition.entries.filter((e) => e.date === today);
    const kcal = sum(meals, (m) => m.kcal);
    const prot = sum(meals, (m) => m.protein);
    const water = sum(data.nutrition.water.filter((w) => w.date === today), (w) => w.ml);

    const pct = (v, max) => (max > 0 ? Math.min(100, Math.round((v / max) * 100)) : 0);
    const over = (v, max) => max > 0 && v > max;

    wrap.innerHTML = `
      <header class="page-header">
        <p class="eyebrow">${esc(formatDate(today, { weekday: true }))}</p>
        <h1>Nutrition</h1>
      </header>

      ${
        !isProfileComplete(data.profile)
          ? `<div class="card" style="margin-bottom:var(--sp-4)">
               <div class="card-label">Objectifs non définis</div>
               <p class="card-sub">Renseigne ta taille, ton poids et ton âge pour que l'app calcule tes besoins.</p>
               <a class="btn primary block cta" href="#/settings" style="margin-top:var(--sp-3)">Compléter mon profil</a>
             </div>`
          : ""
      }

      <div class="card">
        <div class="card-label">Calories</div>
        <div class="card-value ${over(kcal, t.kcal) ? "negative" : ""}">${Math.round(kcal)}<span class="faint" style="font-size:var(--fs-sm)"> / ${t.kcal} kcal</span></div>
        <div class="bar" style="margin-top:var(--sp-3)"><i class="${over(kcal, t.kcal) ? "over" : ""}" style="width:${pct(kcal, t.kcal)}%"></i></div>
      </div>

      <div class="card" style="margin-top:var(--sp-3)">
        <div class="card-label">Protéines</div>
        <div class="card-value">${Math.round(prot)}<span class="faint" style="font-size:var(--fs-sm)"> / ${t.protein} g</span></div>
        <div class="bar" style="margin-top:var(--sp-3)"><i style="width:${pct(prot, t.protein)}%"></i></div>
      </div>

      <div class="card" style="margin-top:var(--sp-3)">
        <div class="card-label">Eau</div>
        <div class="card-value">${(water / 1000).toFixed(2).replace(".", ",")}<span class="faint" style="font-size:var(--fs-sm)"> / ${(t.waterMl / 1000).toFixed(1).replace(".", ",")} L</span></div>
        <div class="bar" style="margin-top:var(--sp-3)"><i style="width:${pct(water, t.waterMl)}%"></i></div>
        <div class="water-row">
          <button class="btn" id="waterAdd">+ 25 cl</button>
          <button class="btn" id="waterBig">+ 50 cl</button>
          <button class="btn ghost" id="waterUndo">Retirer 25 cl</button>
        </div>
      </div>

      <h3 class="section-title">Ajouter un repas</h3>
      <form class="form-card" id="mealForm">
        <input class="input" id="mealName" type="text" maxlength="80" placeholder="Ex : petit-déjeuner, poulet riz…" aria-label="Nom du repas">
        <div class="form-grid" style="margin-top:var(--sp-2)">
          <input class="input" id="mealKcal" type="text" inputmode="decimal" placeholder="Calories" aria-label="Calories">
          <input class="input" id="mealProt" type="text" inputmode="decimal" placeholder="Protéines (g)" aria-label="Protéines en grammes">
        </div>
        <label class="fav-check">
          <input type="checkbox" id="mealFav"> Enregistrer comme repas courant
        </label>
        <button class="btn primary block cta" type="submit">Ajouter</button>
      </form>

      ${
        data.nutrition.favorites.length
          ? `<h3 class="section-title">Repas courants — un appui pour ajouter</h3>
             <div class="chips">${data.nutrition.favorites
               .map(
                 (f) => `<button class="chip" data-fav="${f.id}">
                   ${esc(f.name)} <span class="chip-sub">${Math.round(f.kcal)} kcal · ${Math.round(f.protein)} g</span>
                   <span class="chip-del" data-delfav="${f.id}" role="button" aria-label="Retirer des repas courants">✕</span>
                 </button>`
               )
               .join("")}</div>`
          : ""
      }

      <h3 class="section-title">Aujourd'hui — ${meals.length} repas</h3>
      <div class="list" id="mealList"></div>

      <h3 class="section-title">7 derniers jours</h3>
      <div class="card"><div class="mbars">${week(data, t)}</div></div>
    `;

    // --- eau ---
    wrap.querySelector("#waterAdd").addEventListener("click", () => addWater(today, GLASS_ML));
    wrap.querySelector("#waterBig").addEventListener("click", () => addWater(today, GLASS_ML * 2));
    wrap.querySelector("#waterUndo").addEventListener("click", () => addWater(today, -GLASS_ML));

    // --- repas ---
    wrap.querySelector("#mealForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = clampString(wrap.querySelector("#mealName").value, 80);
      const k = parseNumber(wrap.querySelector("#mealKcal").value) ?? 0;
      const p = parseNumber(wrap.querySelector("#mealProt").value) ?? 0;
      if (!isNonEmptyString(name, 80)) return toast("Donne un nom au repas.", true);
      if (k <= 0 && p <= 0) return toast("Indique au moins des calories ou des protéines.", true);
      const fav = wrap.querySelector("#mealFav").checked;
      update((s) => {
        s.nutrition.entries.push({ id: uid("eat-"), date: today, name, kcal: Math.max(0, k), protein: Math.max(0, p) });
        if (fav && !s.nutrition.favorites.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
          s.nutrition.favorites.push({ id: uid("fav-"), name, kcal: Math.max(0, k), protein: Math.max(0, p) });
        }
      });
    });

    wrap.querySelectorAll("[data-fav]").forEach((b) =>
      b.addEventListener("click", (e) => {
        if (e.target.dataset.delfav) return; // clic sur la croix
        const f = getState().nutrition.favorites.find((x) => x.id === b.dataset.fav);
        if (!f) return;
        update((s) => {
          s.nutrition.entries.push({ id: uid("eat-"), date: today, name: f.name, kcal: f.kcal, protein: f.protein });
        });
        toast(`${f.name} ajouté.`);
      })
    );

    wrap.querySelectorAll("[data-delfav]").forEach((x) =>
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        update((s) => {
          s.nutrition.favorites = s.nutrition.favorites.filter((f) => f.id !== x.dataset.delfav);
        });
      })
    );

    const list = wrap.querySelector("#mealList");
    list.innerHTML = meals.length
      ? meals
          .map(
            (m) => `<div class="row">
              <div class="row-main">
                <div class="row-title">${esc(m.name)}</div>
                <div class="row-sub">${Math.round(m.kcal)} kcal · ${Math.round(m.protein)} g de protéines</div>
              </div>
              <button class="icon-btn danger" data-del="${m.id}" aria-label="Supprimer">✕</button>
            </div>`
          )
          .join("")
      : `<p class="empty">Rien d'enregistré aujourd'hui.</p>`;

    list.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        update((s) => {
          s.nutrition.entries = s.nutrition.entries.filter((x) => x.id !== b.dataset.del);
        });
      })
    );
  }
}

function addWater(date, ml) {
  update((s) => {
    const row = s.nutrition.water.find((w) => w.date === date);
    if (row) row.ml = Math.max(0, row.ml + ml);
    else if (ml > 0) s.nutrition.water.push({ date, ml });
  });
}

// Histogramme des calories des 7 derniers jours.
function week(data, t) {
  const days = lastNDates(7);
  const vals = days.map((d) => ({
    d,
    kcal: sum(data.nutrition.entries.filter((e) => e.date === d), (e) => e.kcal),
  }));
  const max = Math.max(t.kcal || 0, ...vals.map((v) => v.kcal), 1);
  return vals
    .map((v) => {
      const label = new Date(v.d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "narrow" });
      return `<div class="mbar ${v.d === todayISO() ? "current" : ""}" title="${v.d} : ${Math.round(v.kcal)} kcal">
        <i style="height:${Math.round((v.kcal / max) * 100)}%"></i>
        <span class="mbar-label">${esc(label)}</span>
      </div>`;
    })
    .join("");
}

function toast(msg, isError) {
  window.dispatchEvent(new CustomEvent("jarvis:toast", { detail: { msg, isError } }));
}

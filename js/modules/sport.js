import { getState, update, subscribe } from "../state.js";
import { startRest } from "../components/timer.js";
import {
  uid,
  todayISO,
  formatDate,
  formatWeight,
  esc,
  parseNumber,
  parsePositive,
  clampString,
  sum,
} from "../utils.js";

let activeDayId = null;
let activeTab = "seance"; // seance | historique | poids

// Brouillon de la séance en cours : { [exerciseId]: { load, setsDone } }
let draft = {};
let draftDayId = null;

export function render(container) {
  const wrap = document.createElement("div");
  container.appendChild(wrap);
  const unsub = subscribe(draw);
  draw();
  return unsub;

  function draw() {
    const data = getState();
    if (!data) return;
    const program = data.sport.program;
    const days = program.days || [];
    if (!activeDayId || !days.some((d) => d.id === activeDayId)) {
      activeDayId = suggestDay(days);
    }

    const week = currentWeek(program);
    wrap.innerHTML = `
      <header class="page-header">
        <p class="eyebrow">${esc(program.name)}${
      week ? ` · semaine ${week}/${program.weeks}` : ` · ${program.weeks} semaines`
    }</p>
        <h1>Sport</h1>
        ${
          week
            ? `<div class="bar" style="margin-top:var(--sp-3)"><i style="width:${Math.min(100, (week / program.weeks) * 100)}%"></i></div>`
            : ""
        }
        <div class="tabbar" role="tablist">
          ${tabBtn("seance", "Séance")}
          ${tabBtn("progression", "Progression")}
          ${tabBtn("historique", "Historique")}
          ${tabBtn("poids", "Poids")}
        </div>
      </header>
      <div id="sportBody"></div>
    `;

    wrap.querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        activeTab = b.dataset.tab;
        draw();
      })
    );

    const body = wrap.querySelector("#sportBody");
    if (activeTab === "historique") renderHistory(body, data);
    else if (activeTab === "poids") renderWeight(body, data);
    else if (activeTab === "progression") renderProgression(body, data);
    else renderSession(body, data, days);
  }

  function tabBtn(id, label) {
    return `<button class="tab" role="tab" data-tab="${id}" aria-selected="${activeTab === id}">${label}</button>`;
  }
}

// Propose le jour du programme correspondant au jour de la semaine, sinon le 1er.
function suggestDay(days) {
  if (!days.length) return null;
  const weekday = new Date().toLocaleDateString("fr-FR", { weekday: "long" }).toLowerCase();
  const match = days.find((d) => (d.weekday || "").toLowerCase() === weekday);
  return (match || days[0]).id;
}

// --- Séance du jour --------------------------------------------------------

function renderSession(root, data, days) {
  const day = days.find((d) => d.id === activeDayId) || days[0];
  if (!day) {
    root.innerHTML = `<p class="empty">Aucun jour dans le programme.</p>`;
    return;
  }

  if (draftDayId !== day.id) {
    draft = {};
    draftDayId = day.id;
  }

  const lastLoads = data.sport.lastLoads || {};

  root.innerHTML = `
    <div class="tabbar" role="tablist" style="margin-bottom:var(--sp-3)">
      ${days
        .map(
          (d) =>
            `<button class="tab" role="tab" data-day="${d.id}" aria-selected="${d.id === day.id}">${esc(d.weekday)}</button>`
        )
        .join("")}
    </div>

    <h2 class="page-header" style="padding-top:0">${esc(day.title)}</h2>
    <p class="day-intro">${esc(day.intro)}</p>

    <div id="blocks"></div>

    <div class="field" style="margin-top:var(--sp-5)">
      <label class="label" for="sessionNotes">Notes de séance</label>
      <textarea class="textarea" id="sessionNotes" maxlength="500"
        placeholder="Ressenti, douleurs, contexte…"></textarea>
    </div>
    <button class="btn primary block cta" id="saveSession">Enregistrer la séance</button>
  `;

  root.querySelectorAll("[data-day]").forEach((b) =>
    b.addEventListener("click", () => {
      activeDayId = b.dataset.day;
      draft = {};
      draftDayId = b.dataset.day;
      renderSession(root, getState(), days);
    })
  );

  const blocks = root.querySelector("#blocks");
  day.blocks.forEach((block) => {
    const tag = document.createElement("p");
    tag.className = "block-tag";
    tag.textContent = block.name;
    blocks.appendChild(tag);
    block.exercises.forEach((ex) => blocks.appendChild(exerciseCard(ex, lastLoads[ex.id])));
  });

  root.querySelector("#saveSession").addEventListener("click", () => {
    const entries = [];
    day.blocks.forEach((block) =>
      block.exercises.forEach((ex) => {
        const d = draft[ex.id];
        if (!d) return;
        if (d.load === null && !d.setsDone) return;
        entries.push({
          exerciseId: ex.id,
          exerciseName: ex.name,
          load: d.load,
          setsDone: d.setsDone || 0,
          setsPlanned: ex.sets,
        });
      })
    );

    if (!entries.length) {
      toast("Rien à enregistrer : saisis au moins une charge ou coche une série.");
      return;
    }

    update((s) => {
      s.sport.sessions.push({
        id: uid("ses-"),
        date: todayISO(),
        dayId: day.id,
        dayTitle: day.title,
        notes: clampString(root.querySelector("#sessionNotes").value, 500),
        entries,
      });
      entries.forEach((e) => {
        if (e.load !== null) s.sport.lastLoads[e.exerciseId] = e.load;
      });
      // La 1re séance enregistrée démarre le compteur de semaines du bloc.
      if (!s.sport.program.startDate) s.sport.program.startDate = todayISO();
    });

    draft = {};
    toast(`Séance enregistrée — ${entries.length} exercice${entries.length > 1 ? "s" : ""}.`);
  });
}

function exerciseCard(ex, lastLoad) {
  const card = document.createElement("div");
  card.className = "exercise";
  const d = (draft[ex.id] = draft[ex.id] || { load: null, setsDone: 0 });

  card.innerHTML = `
    <div class="ex-head">
      <div><span class="ex-code">${esc(ex.code)}</span><span class="ex-name">${esc(ex.name)}</span></div>
      <span class="ex-scheme">${esc(ex.scheme)}</span>
    </div>
    ${ex.note ? `<p class="ex-note">${esc(ex.note)}</p>` : ""}
    <div class="ex-ledger">
      <span class="ex-last">${
        lastLoad !== undefined && lastLoad !== null
          ? `Dernière charge : <strong class="num">${formatWeight(lastLoad)} kg</strong>`
          : "Première fois sur cet exercice"
      }</span>
      <input class="input compact" type="text" inputmode="decimal" placeholder="kg"
        aria-label="Charge du jour — ${esc(ex.name)}" value="${d.load ?? ""}">
      <div class="set-dots"></div>
      <span class="ex-delta"></span>
    </div>
  `;

  const input = card.querySelector("input");
  const delta = card.querySelector(".ex-delta");
  const dots = card.querySelector(".set-dots");

  input.addEventListener("input", () => {
    d.load = parseNumber(input.value);
    const prev = parseNumber(lastLoad);
    delta.textContent =
      d.load !== null && prev !== null && d.load > prev
        ? `+${formatWeight(d.load - prev)} kg`
        : "";
  });

  for (let i = 1; i <= ex.sets; i++) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "set-dot";
    dot.textContent = ex.timed ? "▶" : String(i);
    dot.setAttribute("aria-pressed", "false");
    dot.setAttribute("aria-label", `Série ${i} — ${ex.name}`);
    dot.addEventListener("click", () => {
      const on = dot.getAttribute("aria-pressed") !== "true";
      dot.setAttribute("aria-pressed", String(on));
      d.setsDone = dots.querySelectorAll('[aria-pressed="true"]').length;
      if (on) startRest(ex.restSeconds, ex.name, ex.timed ? "Effort" : "Repos");
    });
    dots.appendChild(dot);
  }

  return card;
}

// Semaine courante du bloc (1-indexée), null tant qu'aucune séance.
function currentWeek(program) {
  if (!program.startDate) return null;
  const start = new Date(program.startDate + "T12:00:00");
  const now = new Date();
  const days = Math.floor((now - start) / 86400000);
  if (days < 0) return 1;
  return Math.min(program.weeks, Math.floor(days / 7) + 1);
}

// --- Progression -----------------------------------------------------------

function renderProgression(root, data) {
  // Historique de charges par exercice, ordonné par date.
  const history = new Map(); // exerciseId -> { name, points: [{date, load}] }
  [...data.sport.sessions]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach((s) =>
      s.entries.forEach((e) => {
        if (e.load === null) return;
        if (!history.has(e.exerciseId)) {
          history.set(e.exerciseId, { name: e.exerciseName, points: [] });
        }
        history.get(e.exerciseId).points.push({ date: s.date, load: e.load });
      })
    );

  if (!history.size) {
    root.innerHTML = `<p class="empty">Enregistre des séances avec des charges : les courbes de progression apparaîtront ici.</p>`;
    return;
  }

  const rows = [...history.entries()].map(([id, h]) => {
    const loads = h.points.map((p) => p.load);
    const last = loads[loads.length - 1];
    const first = loads[0];
    const max = Math.max(...loads);
    const isPR = last === max && loads.length > 1;
    const delta = last - first;
    return { id, ...h, last, max, delta, isPR };
  });

  root.innerHTML = `<div class="list">${rows
    .map(
      (r) => `
    <div class="card">
      <div class="row" style="border:0;padding:0;background:transparent">
        <div class="row-main">
          <div class="row-title">${esc(r.name)} ${r.isPR ? `<span class="badge pos">PR</span>` : ""}</div>
          <div class="row-sub">${r.points.length} relevé${r.points.length > 1 ? "s" : ""} ·
            record <span class="num">${formatWeight(r.max)} kg</span></div>
        </div>
        <div class="row-actions">
          <span class="num">${formatWeight(r.last)} kg</span>
          ${
            r.delta !== 0
              ? `<span class="badge ${r.delta > 0 ? "pos" : "neg"}">${r.delta > 0 ? "+" : "−"}${formatWeight(Math.abs(r.delta))}</span>`
              : ""
          }
        </div>
      </div>
      ${sparkline(r.points.map((p) => p.load))}
    </div>`
    )
    .join("")}</div>`;
}

// Mini-courbe SVG, sans dépendance. Échelle sur min/max de la série.
function sparkline(values) {
  if (values.length < 2) return "";
  const W = 280;
  const H = 36;
  const PAD = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `${PAD},${H} ${line} ${W - PAD},${H}`;
  const [lx, ly] = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <polygon class="spark-fill" points="${area}"></polygon>
    <polyline points="${line}"></polyline>
    <circle cx="${lx}" cy="${ly}" r="3"></circle>
  </svg>`;
}

// --- Historique ------------------------------------------------------------

function renderHistory(root, data) {
  const sessions = [...data.sport.sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!sessions.length) {
    root.innerHTML = `<p class="empty">Aucune séance enregistrée pour l'instant.</p>`;
    return;
  }

  root.innerHTML = `<div class="list">${sessions
    .map((s) => {
      const volume = sum(s.entries, (e) => (e.load || 0) * (e.setsDone || 0));
      return `
      <div class="card">
        <div class="row" style="border:0;padding:0;background:transparent">
          <div class="row-main">
            <div class="row-title">${esc(s.dayTitle)}</div>
            <div class="row-sub">${formatDate(s.date, { year: true })}</div>
          </div>
          <div class="row-actions">
            <span class="num faint">${Math.round(volume)} kg</span>
            <button class="icon-btn danger" data-del="${s.id}" aria-label="Supprimer">✕</button>
          </div>
        </div>
        <div style="margin-top:var(--sp-2)">
          ${s.entries
            .map(
              (e) =>
                `<div class="row-sub">${esc(e.exerciseName)} — <span class="num">${
                  e.load !== null ? formatWeight(e.load) + " kg" : "—"
                }</span> · ${e.setsDone}/${e.setsPlanned} séries</div>`
            )
            .join("")}
        </div>
        ${s.notes ? `<p class="ex-note">« ${esc(s.notes)} »</p>` : ""}
      </div>`;
    })
    .join("")}</div>`;

  root.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirm("Supprimer cette séance ?")) return;
      update((s) => {
        s.sport.sessions = s.sport.sessions.filter((x) => x.id !== b.dataset.del);
      });
    })
  );
}

// --- Poids de corps --------------------------------------------------------

function renderWeight(root, data) {
  const bw = data.sport.program.bodyweight || { start: 60, target: 64 };
  const weighIns = [...data.sport.weighIns].sort((a, b) => (a.date < b.date ? 1 : -1));
  const current = weighIns[0]?.kg ?? bw.start;
  const span = bw.target - bw.start;
  const pct = span === 0 ? 0 : Math.max(0, Math.min(100, ((current - bw.start) / span) * 100));
  const left = bw.target - current;

  root.innerHTML = `
    <div class="card">
      <div class="card-label">Poids actuel</div>
      <div class="card-value">${formatWeight(current)} kg</div>
      <div class="bar" style="margin-top:var(--sp-3)"><i style="width:${pct}%"></i></div>
      <div class="row-sub" style="display:flex;justify-content:space-between;margin-top:var(--sp-2)">
        <span>${formatWeight(bw.start)} kg — départ</span>
        <span>${left > 0 ? formatWeight(left) + " kg à prendre" : "objectif atteint"}</span>
      </div>
    </div>

    <form class="form-card" id="weighForm" style="margin-top:var(--sp-3)">
      <div class="form-grid">
        <input class="input" id="weighKg" type="text" inputmode="decimal" placeholder="Poids en kg" aria-label="Poids en kg">
        <input class="input" id="weighDate" type="date" value="${todayISO()}" aria-label="Date">
      </div>
      <button class="btn primary block cta" type="submit" style="margin-top:var(--sp-2)">Enregistrer le poids</button>
    </form>

    <div class="list" id="weighList"></div>
  `;

  root.querySelector("#weighForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const kg = parsePositive(root.querySelector("#weighKg").value);
    const date = root.querySelector("#weighDate").value;
    if (kg === null) return toast("Poids invalide.", true);
    update((s) => {
      s.sport.weighIns = s.sport.weighIns.filter((w) => w.date !== date);
      s.sport.weighIns.push({ date, kg });
    });
  });

  const list = root.querySelector("#weighList");
  list.innerHTML = weighIns.length
    ? weighIns
        .map(
          (w) => `
      <div class="row">
        <span class="row-sub">${formatDate(w.date, { year: true })}</span>
        <div class="row-actions">
          <span class="num">${formatWeight(w.kg)} kg</span>
          <button class="icon-btn danger" data-del-w="${w.date}" aria-label="Supprimer">✕</button>
        </div>
      </div>`
        )
        .join("")
    : `<p class="empty">Aucun relevé de poids.</p>`;

  list.querySelectorAll("[data-del-w]").forEach((b) =>
    b.addEventListener("click", () => {
      update((s) => {
        s.sport.weighIns = s.sport.weighIns.filter((w) => w.date !== b.dataset.delW);
      });
    })
  );
}

function toast(msg, isError) {
  window.dispatchEvent(new CustomEvent("jarvis:toast", { detail: { msg, isError } }));
}

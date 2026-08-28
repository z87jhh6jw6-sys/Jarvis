import { getState, update, subscribe } from "../state.js";
import { startRest } from "../components/timer.js";
import { BLOCK_TEMPLATES, suggestNext, buildProgram, templateById } from "../blocks.js";
import {
  uid,
  todayISO,
  formatDate,
  formatWeight,
  esc,
  parseNumber,
  parsePositive,
  clampString,
  isNonEmptyString,
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
  // Changer d'onglet interne ou de bloc ne modifie pas forcément le state :
  // on redessine alors explicitement.
  const onRerender = () => draw();
  window.addEventListener("jarvis:rerender", onRerender);
  draw();
  return () => {
    unsub();
    window.removeEventListener("jarvis:rerender", onRerender);
  };

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
          ${tabBtn("programme", "Programme")}
          ${tabBtn("progression", "Progression")}
          ${tabBtn("historique", "Historique")}
          ${tabBtn("poids", "Poids")}
          ${tabBtn("blocs", "Blocs")}
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
    else if (activeTab === "programme") renderEditor(body, data, days);
    else if (activeTab === "blocs") renderBlocks(body, data);
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

  const finished = blockFinished(data.sport.program);

  root.innerHTML = `
    ${
      finished
        ? `<div class="hero" style="margin-bottom:var(--sp-4)">
             <div class="hero-label">Bloc terminé</div>
             <div class="hero-value">${esc(data.sport.program.name)} — ${data.sport.program.weeks} semaines bouclées</div>
             <div class="hero-sub">Le corps s'est adapté : c'est le moment de changer de bloc pour relancer la progression.</div>
             <button class="btn block cta" id="goBlocks" style="margin-top:var(--sp-3);background:var(--c-brand-contrast);color:var(--c-brand);border-color:var(--c-brand-contrast)">Choisir la suite</button>
           </div>`
        : ""
    }
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

  root.querySelector("#goBlocks")?.addEventListener("click", () => {
    activeTab = "blocs";
    window.dispatchEvent(new CustomEvent("jarvis:rerender"));
  });

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

// --- Blocs ---------------------------------------------------------------
// Un programme ne dure pas éternellement : au bout de 10 à 12 semaines le
// corps s'est adapté. On archive le bloc terminé et on enchaîne.

function blockFinished(program) {
  if (!program?.weeks || !program.startDate) return false;
  return currentWeek(program) >= program.weeks;
}

function renderBlocks(root, data) {
  const program = data.sport.program;
  const week = currentWeek(program);
  const finished = blockFinished(program);
  const lastWeigh = [...data.sport.weighIns].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const currentKg = lastWeigh?.kg ?? data.profile?.weightKg ?? null;
  const suggested = suggestNext(program, data.profile, currentKg);
  const target = data.profile?.targetWeightKg;
  const reached = target && currentKg && currentKg >= target;

  root.innerHTML = `
    <div class="card">
      <div class="card-label">Bloc en cours</div>
      <div class="card-value" style="font-size:var(--fs-lg)">${esc(program.name || "Bloc 1")}</div>
      <div class="card-sub">${
        program.weeks
          ? week
            ? `semaine ${week} sur ${program.weeks}${finished ? " — terminé" : ""}`
            : `${program.weeks} semaines — démarre à ta première séance enregistrée`
          : "sans limite de durée"
      }</div>
      ${
        program.weeks && week
          ? `<div class="bar" style="margin-top:var(--sp-3)"><i style="width:${Math.min(100, (week / program.weeks) * 100)}%"></i></div>`
          : ""
      }
    </div>

    ${
      reached
        ? `<div class="card" style="margin-top:var(--sp-3)">
             <div class="card-label">Objectif de poids atteint</div>
             <p class="card-sub">Tu es à ${formatWeight(currentKg)} kg pour un objectif de ${formatWeight(target)} kg.
             Le bloc Entretien est fait pour la suite : garder ce que tu as construit sans y passer ta vie.</p>
           </div>`
        : ""
    }

    <h3 class="section-title">Bloc conseillé pour la suite</h3>
    ${suggested ? blockCard(suggested, true) : ""}

    <h3 class="section-title">Autres blocs</h3>
    ${BLOCK_TEMPLATES.filter((t) => t.id !== suggested?.id).map((t) => blockCard(t, false)).join("")}

    ${
      data.sport.archive.length
        ? `<h3 class="section-title">Blocs terminés</h3>
           <div class="list">${data.sport.archive
             .map(
               (b) => `<div class="row">
                 <div class="row-main">
                   <div class="row-title">${esc(b.name)}</div>
                   <div class="row-sub">${b.startDate ? formatDate(b.startDate) : "?"} → ${b.endDate ? formatDate(b.endDate) : "?"} · ${b.sessions} séance${b.sessions > 1 ? "s" : ""}</div>
                 </div>
               </div>`
             )
             .join("")}</div>`
        : ""
    }
  `;

  root.querySelectorAll("[data-start-block]").forEach((b) =>
    b.addEventListener("click", () => startBlock(b.dataset.startBlock, root))
  );
}

function blockCard(t, recommended) {
  return `
    <div class="card" style="margin-bottom:var(--sp-3)">
      <div class="row" style="border:0;padding:0;background:transparent;box-shadow:none">
        <div class="row-main">
          <div class="row-title">${esc(t.name)} ${recommended ? '<span class="badge pos">conseillé</span>' : ""}</div>
          <div class="row-sub">${esc(t.subtitle)}</div>
        </div>
      </div>
      <p class="ex-note">${esc(t.why)}</p>
      <button class="btn ${recommended ? "primary cta" : ""} block" data-start-block="${t.id}" style="margin-top:var(--sp-3)">
        Démarrer ce bloc
      </button>
    </div>`;
}

function startBlock(templateId, root) {
  const t = templateById(templateId);
  if (!t) return;
  const data = getState();
  const sessions = data.sport.sessions.length;
  if (
    !confirm(
      `Démarrer « ${t.name} » ?\n\nLe bloc en cours sera archivé. Tes séances et tes charges sont conservées, seuls les exercices du programme changent. Ta routine du matin reste en place.`
    )
  )
    return;

  update((s) => {
    const old = s.sport.program;
    s.sport.archive.push({
      name: old.name || "Bloc",
      startDate: old.startDate || null,
      endDate: todayISO(),
      sessions,
      templateId: old.templateId || "",
    });
    const nextNumber = (old.blockNumber || 1) + 1;
    s.sport.program = buildProgram(t, old, nextNumber);
  });

  activeDayId = null;
  activeTab = "seance";
  draft = {};
  draftDayId = null;
  toast(`${t.name} démarré. Bonne série.`);
  window.dispatchEvent(new CustomEvent("jarvis:rerender"));
}

// --- Éditeur de programme ------------------------------------------------
// Le programme n'est pas figé : on doit pouvoir remplacer un exercice qui
// ne passe pas, alléger un jour, ou en retirer un dont on a marre.

function renderEditor(root, data, days) {
  const day = days.find((d) => d.id === activeDayId) || days[0];
  if (!day) {
    root.innerHTML = `<p class="empty">Aucun jour dans le programme.</p>`;
    return;
  }

  root.innerHTML = `
    <div class="tabbar" role="tablist" style="margin-bottom:var(--sp-3)">
      ${days
        .map(
          (d) =>
            `<button class="tab" role="tab" data-day="${d.id}" aria-selected="${d.id === day.id}">${esc(d.weekday)}</button>`
        )
        .join("")}
    </div>
    <p class="card-sub" style="margin-bottom:var(--sp-4)">
      Modifie librement : les charges déjà enregistrées restent liées à
      l'exercice, donc renommer ne fait pas perdre l'historique.
    </p>
    <div id="editBlocks"></div>
    <button class="btn block ghost" id="addBlock" style="margin-top:var(--sp-4)">+ Ajouter un bloc</button>
  `;

  root.querySelectorAll("[data-day]").forEach((b) =>
    b.addEventListener("click", () => {
      activeDayId = b.dataset.day;
      renderEditor(root, getState(), days);
    })
  );

  const box = root.querySelector("#editBlocks");
  day.blocks.forEach((block, bi) => {
    const el = document.createElement("div");
    el.className = "card";
    el.style.marginBottom = "var(--sp-3)";
    el.innerHTML = `
      <div class="row" style="border:0;padding:0;background:transparent;box-shadow:none">
        <input class="input" value="${esc(block.name)}" data-block-name="${bi}" aria-label="Nom du bloc">
        <button class="icon-btn danger" data-del-block="${bi}" aria-label="Supprimer le bloc">✕</button>
      </div>
      <div class="edit-list"></div>
      <button class="btn block subtle" data-add-ex="${bi}" style="margin-top:var(--sp-2)">+ Ajouter un exercice</button>
    `;
    const list = el.querySelector(".edit-list");
    block.exercises.forEach((ex, ei) => {
      const row = document.createElement("div");
      row.className = "edit-ex";
      row.innerHTML = `
        <input class="input" value="${esc(ex.name)}" data-ex="${bi}:${ei}:name" aria-label="Nom de l'exercice">
        <div class="form-grid" style="margin-top:var(--sp-2)">
          <input class="input" value="${esc(ex.scheme)}" data-ex="${bi}:${ei}:scheme" aria-label="Séries et répétitions" placeholder="4 × 8">
          <input class="input" value="${ex.sets}" type="text" inputmode="numeric" data-ex="${bi}:${ei}:sets" aria-label="Nombre de séries à cocher">
        </div>
        <div class="form-grid" style="margin-top:var(--sp-2)">
          <input class="input" value="${ex.restSeconds}" type="text" inputmode="numeric" data-ex="${bi}:${ei}:restSeconds" aria-label="Repos en secondes" placeholder="Repos (s)">
          <button class="btn danger" data-del-ex="${bi}:${ei}">Supprimer</button>
        </div>
        <textarea class="textarea" data-ex="${bi}:${ei}:note" placeholder="Note technique (optionnel)" aria-label="Note">${esc(ex.note || "")}</textarea>
      `;
      list.appendChild(row);
    });
    box.appendChild(el);
  });

  // Enregistrement à la volée
  box.querySelectorAll("[data-ex]").forEach((input) =>
    input.addEventListener("change", () => {
      const [bi, ei, field] = input.dataset.ex.split(":");
      update((s) => {
        const d = s.sport.program.days.find((x) => x.id === day.id);
        const ex = d?.blocks[bi]?.exercises[ei];
        if (!ex) return;
        if (field === "sets" || field === "restSeconds") {
          const n = parseNumber(input.value);
          if (n !== null && n >= 0) ex[field] = Math.round(n);
        } else if (field === "name") {
          if (isNonEmptyString(input.value, 120)) ex.name = clampString(input.value, 120);
        } else {
          ex[field] = clampString(input.value, field === "note" ? 400 : 40);
        }
      });
    })
  );

  box.querySelectorAll("[data-block-name]").forEach((input) =>
    input.addEventListener("change", () => {
      update((s) => {
        const d = s.sport.program.days.find((x) => x.id === day.id);
        const b = d?.blocks[input.dataset.blockName];
        if (b && isNonEmptyString(input.value, 80)) b.name = clampString(input.value, 80);
      });
    })
  );

  box.querySelectorAll("[data-del-ex]").forEach((b) =>
    b.addEventListener("click", () => {
      const [bi, ei] = b.dataset.delEx.split(":");
      if (!confirm("Supprimer cet exercice du programme ?")) return;
      update((s) => {
        const d = s.sport.program.days.find((x) => x.id === day.id);
        d?.blocks[bi]?.exercises.splice(ei, 1);
      });
      renderEditor(root, getState(), getState().sport.program.days);
    })
  );

  box.querySelectorAll("[data-add-ex]").forEach((b) =>
    b.addEventListener("click", () => {
      update((s) => {
        const d = s.sport.program.days.find((x) => x.id === day.id);
        const block = d?.blocks[b.dataset.addEx];
        if (!block) return;
        block.exercises.push({
          id: uid("ex-"),
          code: String.fromCharCode(65 + block.exercises.length),
          name: "Nouvel exercice",
          scheme: "3 × 10",
          note: "",
          kind: "v",
          sets: 3,
          restSeconds: 90,
          timed: false,
        });
      });
      renderEditor(root, getState(), getState().sport.program.days);
    })
  );

  box.querySelectorAll("[data-del-block]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirm("Supprimer ce bloc et tous ses exercices ?")) return;
      update((s) => {
        const d = s.sport.program.days.find((x) => x.id === day.id);
        d?.blocks.splice(b.dataset.delBlock, 1);
      });
      renderEditor(root, getState(), getState().sport.program.days);
    })
  );

  root.querySelector("#addBlock").addEventListener("click", () => {
    update((s) => {
      const d = s.sport.program.days.find((x) => x.id === day.id);
      d?.blocks.push({ name: "Nouveau bloc — repos 90 s", exercises: [] });
    });
    renderEditor(root, getState(), getState().sport.program.days);
  });
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
  const bwSeed = data.sport.program.bodyweight || { start: 60, target: 64 };
  // Le poids visé se règle dans le profil ; le programme ne sert que de repli.
  const bw = {
    start: data.profile?.weightKg ?? bwSeed.start,
    target: data.profile?.targetWeightKg ?? bwSeed.target,
  };
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
        <span>départ ${formatWeight(bw.start)} kg</span>
        <span>objectif ${formatWeight(bw.target)} kg</span>
      </div>
      <div class="card-sub">${
        left > 0
          ? formatWeight(left) + " kg à prendre"
          : left < 0
            ? formatWeight(-left) + " kg à perdre"
            : "objectif atteint"
      }${data.profile?.targetWeightKg ? "" : " — règle ton poids visé dans les Réglages"}</div>
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

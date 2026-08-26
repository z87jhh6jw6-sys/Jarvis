import { getState, update, subscribe } from "../state.js";
import { uid, todayISO, formatDate, lastNDates, esc, clampString, isNonEmptyString } from "../utils.js";

const GRID_DAYS = 28;

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
    const active = data.habits.habits.filter((h) => !h.archived);
    const archived = data.habits.habits.filter((h) => h.archived);
    const doneToday = countDone(data, today);

    wrap.innerHTML = `
      <header class="page-header">
        <p class="eyebrow">${esc(formatDate(today, { weekday: true, year: true }))}</p>
        <h1>Habitudes</h1>
      </header>

      <div class="card">
        <div class="card-label">Aujourd'hui</div>
        <div class="card-value">${doneToday} / ${active.length}</div>
        <div class="bar" style="margin-top:var(--sp-3)">
          <i class="positive" style="width:${active.length ? (doneToday / active.length) * 100 : 0}%"></i>
        </div>
      </div>

      <form class="form-card" id="newHabit" style="margin-top:var(--sp-4)">
        <input class="input" id="habitName" type="text" maxlength="80"
          placeholder="Nouvelle habitude" aria-label="Nom de l'habitude">
        <div class="form-grid" style="margin-top:var(--sp-2)">
          <select class="select" id="habitTarget" aria-label="Objectif par semaine">
            <option value="">Tous les jours</option>
            <option value="6">6× / semaine</option>
            <option value="5">5× / semaine</option>
            <option value="4">4× / semaine</option>
            <option value="3">3× / semaine</option>
            <option value="2">2× / semaine</option>
            <option value="1">1× / semaine</option>
          </select>
          <button class="btn primary" type="submit" style="flex:0 0 auto">Ajouter</button>
        </div>
      </form>

      <div id="habitList" class="list"></div>
      ${archived.length ? `<h3 class="section-title">Archivées</h3><div id="archivedList" class="list"></div>` : ""}
    `;

    wrap.querySelector("#newHabit").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = wrap.querySelector("#habitName");
      const name = clampString(input.value, 80);
      if (!isNonEmptyString(name, 80)) return;
      const targetRaw = wrap.querySelector("#habitTarget").value;
      update((s) => {
        s.habits.habits.push({
          id: uid("hab-"),
          name,
          createdAt: new Date().toISOString(),
          archived: false,
          targetPerWeek: targetRaw ? Number(targetRaw) : null,
        });
      });
      input.value = "";
    });

    const list = wrap.querySelector("#habitList");
    if (!active.length) {
      list.innerHTML = `<p class="empty">Aucune habitude suivie. Ajoute la première ci-dessus.</p>`;
    } else {
      active.forEach((h) => list.appendChild(habitCard(data, h, today)));
    }

    const archList = wrap.querySelector("#archivedList");
    if (archList) {
      archList.innerHTML = archived
        .map(
          (h) => `
        <div class="row">
          <div class="row-main"><div class="row-title">${esc(h.name)}</div></div>
          <div class="row-actions">
            <button class="btn sm" data-unarchive="${h.id}">Réactiver</button>
            <button class="icon-btn danger" data-del="${h.id}" aria-label="Supprimer">✕</button>
          </div>
        </div>`
        )
        .join("");

      archList.querySelectorAll("[data-unarchive]").forEach((b) =>
        b.addEventListener("click", () => setArchived(b.dataset.unarchive, false))
      );
      archList.querySelectorAll("[data-del]").forEach((b) =>
        b.addEventListener("click", () => deleteHabit(b.dataset.del))
      );
    }
  }
}

function habitCard(data, habit, today) {
  const checkins = data.habits.checkins.filter((c) => c.habitId === habit.id);
  const doneDates = new Set(checkins.filter((c) => c.done).map((c) => c.date));
  const on = doneDates.has(today);
  const streak = computeStreak(doneDates, today);
  const best = computeBestStreak(doneDates);
  const days = lastNDates(GRID_DAYS);
  const week = lastNDates(7);
  const doneThisWeek = week.filter((d) => doneDates.has(d)).length;
  const target = habit.targetPerWeek;
  const weekBadge = target
    ? `<span class="badge ${doneThisWeek >= target ? "pos" : ""}">${doneThisWeek}/${target} cette semaine</span>`
    : "";

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="row" style="border:0;padding:0;background:transparent">
      <div class="row-main">
        <div class="row-title">${esc(habit.name)} ${weekBadge}</div>
        <div class="row-sub">${streak} jour${streak > 1 ? "s" : ""} d'affilée${
    best > streak ? ` · record ${best}` : streak >= 2 && best === streak ? " · record en cours" : ""
  }</div>
      </div>
      <div class="row-actions">
        <button class="check-btn ${on ? "on" : ""}" data-toggle
          aria-pressed="${on}" aria-label="Valider ${esc(habit.name)} aujourd'hui">✓</button>
        <button class="icon-btn" data-archive aria-label="Archiver">⌫</button>
      </div>
    </div>
    <div class="habit-grid">
      ${days.map((d) => `<span class="habit-dot ${doneDates.has(d) ? "on" : ""}" title="${d}"></span>`).join("")}
    </div>
  `;

  card.querySelector("[data-toggle]").addEventListener("click", () => toggle(habit.id, today));
  card.querySelector("[data-archive]").addEventListener("click", () => setArchived(habit.id, true));
  return card;
}

function toggle(habitId, date) {
  update((s) => {
    const existing = s.habits.checkins.find((c) => c.habitId === habitId && c.date === date);
    if (existing) existing.done = !existing.done;
    else s.habits.checkins.push({ id: uid("chk-"), habitId, date, done: true });
  });
}

function setArchived(habitId, archived) {
  update((s) => {
    const h = s.habits.habits.find((x) => x.id === habitId);
    if (h) h.archived = archived;
  });
}

function deleteHabit(habitId) {
  if (!confirm("Supprimer cette habitude et tout son historique ?")) return;
  update((s) => {
    s.habits.habits = s.habits.habits.filter((h) => h.id !== habitId);
    s.habits.checkins = s.habits.checkins.filter((c) => c.habitId !== habitId);
  });
}

function countDone(data, date) {
  const activeIds = new Set(data.habits.habits.filter((h) => !h.archived).map((h) => h.id));
  return data.habits.checkins.filter((c) => c.date === date && c.done && activeIds.has(c.habitId))
    .length;
}

// Série en cours : on remonte jour par jour tant que c'est validé.
// Le jour même ne casse pas la série s'il n'est pas encore coché.
// Meilleure série jamais atteinte, en parcourant les dates triées.
function computeBestStreak(doneDates) {
  const dates = [...doneDates].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of dates) {
    if (prev) {
      const p = new Date(prev + "T12:00:00");
      p.setDate(p.getDate() + 1);
      run = p.toISOString().slice(0, 10) === d ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

function computeStreak(doneDates, today) {
  let streak = 0;
  const cursor = new Date(today + "T12:00:00");
  if (!doneDates.has(today)) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!doneDates.has(iso)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

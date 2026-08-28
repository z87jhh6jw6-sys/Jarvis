// Accueil = "qu'est-ce que je dois faire aujourd'hui ?"
// Agrège les quatre modules en actions concrètes, pas en statistiques.

import { getState, subscribe } from "../state.js";
import { upcomingDue } from "./finance.js";
import { ring } from "../components/ring.js";
import { effectiveTargets } from "../profile.js";
import {
  todayISO,
  currentMonth,
  formatDate,
  formatMoney,
  formatWeight,
  lastNDates,
  esc,
  sum,
} from "../utils.js";

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
    const ym = currentMonth();
    const weekday = new Date().toLocaleDateString("fr-FR", { weekday: "long" }).toLowerCase();

    // --- Sport : séance prévue aujourd'hui ? déjà faite ? ---
    const days = data.sport.program.days || [];
    const plannedDay = days.find((d) => (d.weekday || "").toLowerCase() === weekday);
    const doneToday = data.sport.sessions.some((s) => s.date === today);
    const sessionsWeek = data.sport.sessions.filter((s) => lastNDates(7).includes(s.date)).length;

    // --- Habitudes restantes ---
    const activeHabits = data.habits.habits.filter((h) => !h.archived);
    const doneIds = new Set(
      data.habits.checkins.filter((c) => c.date === today && c.done).map((c) => c.habitId)
    );
    const remainingHabits = activeHabits.filter((h) => !doneIds.has(h.id));

    // --- Tâches du jour / en retard ---
    const openTasks = data.tasks.filter((t) => !t.done);
    const overdue = openTasks.filter((t) => t.due && t.due < today);
    const dueToday = openTasks.filter((t) => t.due === today);

    // --- Budget : état du mois + prochaine échéance ---
    const planned = sum(data.finance.postes, (p) => p.planned);
    const spent = sum(
      data.finance.transactions.filter((t) => t.date.startsWith(ym)),
      (t) => t.amount
    );
    const nextDue = upcomingDue(data, 1)[0];

    // --- Nutrition ---
    const targets = effectiveTargets(data.profile);
    const protToday = sum(
      data.nutrition.entries.filter((e) => e.date === today),
      (e) => e.protein
    );

    // --- Poids ---
    const bw = data.sport.program.bodyweight || { start: 60, target: 64 };
    const lastWeigh = [...data.sport.weighIns].sort((a, b) => (a.date < b.date ? 1 : -1))[0];

    // --- Le focus du jour : la première chose à faire ---
    const focus = pickFocus();

    wrap.innerHTML = `
      <header class="page-header">
        <div class="header-row">
          <div>
            <p class="eyebrow">${esc(formatDate(today, { weekday: true, year: true }))}</p>
            <h1>Jarvis</h1>
          </div>
          <a class="btn sm" href="#/settings" aria-label="Réglages et sauvegarde">⚙ Réglages</a>
        </div>
      </header>

      <div class="hero ${overdue.length ? "alert" : ""}">
        <div class="hero-label">Priorité du moment</div>
        <div class="hero-value">${focus.title}</div>
        ${focus.sub ? `<div class="hero-sub">${focus.sub}</div>` : ""}
      </div>

      <div class="card" style="margin-top:var(--sp-3)">
        <div class="ring-grid">
          ${ring(sessionsWeek / 3, {
            value: String(sessionsWeek),
            unit: "/3 séances",
            label: "Sport",
            color: "var(--brand-sport)",
          })}
          ${ring(planned ? spent / planned : 0, {
            value: planned ? Math.round((spent / planned) * 100) : 0,
            unit: "% budget",
            label: "Budget",
            color: "var(--brand-budget)",
            alert: planned > 0 && spent > planned,
          })}
          ${ring(activeHabits.length ? (activeHabits.length - remainingHabits.length) / activeHabits.length : 0, {
            value: `${activeHabits.length - remainingHabits.length}`,
            unit: `/${activeHabits.length} cochées`,
            label: "Habitudes",
            color: "var(--brand-habits)",
          })}
          ${ring(targets.protein ? protToday / targets.protein : 0, {
            value: String(Math.round(protToday)),
            unit: targets.protein ? `/${targets.protein} g prot.` : "g prot.",
            label: "Nutrition",
            color: "var(--brand-nutrition)",
          })}
        </div>
      </div>

      <h3 class="section-title">Aujourd'hui</h3>
      <div class="card">
        ${todoLine(
          plannedDay
            ? doneToday
              ? `Séance ${esc(plannedDay.title)} — faite ✓`
              : `Séance <a href="#/sport"><strong>${esc(plannedDay.title)}</strong></a> prévue`
            : `Repos — pas de séance prévue le ${esc(weekday)}`,
          doneToday || !plannedDay
        )}
        ${todoLine(
          remainingHabits.length
            ? `<a href="#/habits">${remainingHabits.length} habitude${remainingHabits.length > 1 ? "s" : ""} à cocher</a> : ${esc(
                remainingHabits.slice(0, 3).map((h) => h.name).join(", ")
              )}${remainingHabits.length > 3 ? "…" : ""}`
            : activeHabits.length
              ? "Toutes les habitudes cochées ✓"
              : `<a href="#/habits">Aucune habitude suivie — commence par en créer une</a>`,
          !remainingHabits.length && activeHabits.length > 0
        )}
        ${
          overdue.length
            ? todoLine(
                `<a href="#/tasks"><strong class="negative">${overdue.length} tâche${overdue.length > 1 ? "s" : ""} en retard</strong></a> : ${esc(overdue[0].title)}${overdue.length > 1 ? "…" : ""}`,
                false
              )
            : ""
        }
        ${
          dueToday.length
            ? todoLine(
                `<a href="#/tasks">${dueToday.length} tâche${dueToday.length > 1 ? "s" : ""} pour aujourd'hui</a> : ${esc(dueToday[0].title)}${dueToday.length > 1 ? "…" : ""}`,
                false
              )
            : ""
        }
        ${
          nextDue && nextDue.inDays <= 3
            ? todoLine(
                `Prélèvement <strong>${esc(nextDue.name)}</strong> (${formatMoney(nextDue.planned)}) ${
                  nextDue.inDays === 0 ? "aujourd'hui" : nextDue.inDays === 1 ? "demain" : `dans ${nextDue.inDays} jours`
                }`,
                false
              )
            : ""
        }
      </div>

      <h3 class="section-title">Vue d'ensemble</h3>
      <div class="card-grid cols-2">
        <a class="card" href="#/sport">
          <span class="card-arrow" aria-hidden="true">↗</span>
          <div class="card-label">Sport</div>
          <div class="card-value">${sessionsWeek}<span class="faint" style="font-size:var(--fs-sm)"> /3 séances</span></div>
          <div class="card-sub">cette semaine · poids ${formatWeight(lastWeigh?.kg ?? bw.start)} → ${formatWeight(bw.target)} kg</div>
        </a>
        <a class="card" href="#/finance">
          <span class="card-arrow" aria-hidden="true">↗</span>
          <div class="card-label">Budget du mois</div>
          <div class="card-value ${spent > planned ? "negative" : ""}">${formatMoney(spent, { cents: false })}</div>
          <div class="card-sub">sur ${formatMoney(planned, { cents: false })} prévus</div>
        </a>
        <a class="card" href="#/habits">
          <span class="card-arrow" aria-hidden="true">↗</span>
          <div class="card-label">Habitudes</div>
          <div class="card-value">${activeHabits.length - remainingHabits.length}/${activeHabits.length}</div>
          <div class="card-sub">cochées aujourd'hui</div>
        </a>
        <a class="card" href="#/tasks">
          <span class="card-arrow" aria-hidden="true">↗</span>
          <div class="card-label">Tâches</div>
          <div class="card-value ${overdue.length ? "negative" : ""}">${openTasks.length}</div>
          <div class="card-sub">${overdue.length ? `dont ${overdue.length} en retard` : "en cours"}</div>
        </a>
      </div>
    `;

    function pickFocus() {
      if (overdue.length) {
        return {
          title: `Rattraper : ${esc(overdue[0].title)}`,
          sub: overdue.length > 1 ? `et ${overdue.length - 1} autre${overdue.length > 2 ? "s" : ""} tâche(s) en retard` : "tâche en retard",
        };
      }
      if (plannedDay && !doneToday) {
        return {
          title: `Séance ${esc(plannedDay.title)}`,
          sub: `${plannedDay.blocks.reduce((n, b) => n + b.exercises.length, 0)} exercices au programme`,
        };
      }
      if (dueToday.length) {
        return { title: esc(dueToday[0].title), sub: "à faire aujourd'hui" };
      }
      if (remainingHabits.length) {
        return {
          title: esc(remainingHabits[0].name),
          sub: remainingHabits.length > 1 ? `et ${remainingHabits.length - 1} autre(s) habitude(s)` : "dernière habitude du jour",
        };
      }
      return { title: "Tout est fait", sub: "rien d'urgent — profite" };
    }
  }
}

function todoLine(html, muted) {
  return `<div class="todo-line ${muted ? "faint" : ""}"><span class="dot" style="${muted ? "opacity:.3" : ""}"></span><span>${html}</span></div>`;
}

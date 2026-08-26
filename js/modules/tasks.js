import { getState, update, subscribe } from "../state.js";
import {
  uid,
  todayISO,
  formatDate,
  esc,
  clampString,
  isNonEmptyString,
  isValidDateISO,
} from "../utils.js";

const PRIO = { haute: "🔴", normale: "", basse: "⚪" };

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

    const open = data.tasks.filter((t) => !t.done);
    const overdue = open.filter((t) => t.due && t.due < today);
    const dueToday = open.filter((t) => t.due === today);
    const upcoming = open
      .filter((t) => !t.due || t.due > today)
      .sort((a, b) => {
        if (a.due && b.due) return a.due < b.due ? -1 : 1;
        if (a.due) return -1;
        if (b.due) return 1;
        return prioRank(a) - prioRank(b);
      });
    const doneRecent = data.tasks
      .filter((t) => t.done)
      .sort((a, b) => ((a.doneAt || "") < (b.doneAt || "") ? 1 : -1))
      .slice(0, 10);

    wrap.innerHTML = `
      <header class="page-header">
        <p class="eyebrow">${open.length} en cours${overdue.length ? ` · ${overdue.length} en retard` : ""}</p>
        <h1>Tâches</h1>
      </header>

      <form class="form-card" id="newTask">
        <input class="input" id="taskTitle" type="text" maxlength="140"
          placeholder="Nouvelle tâche" aria-label="Titre de la tâche">
        <div class="form-grid" style="margin-top:var(--sp-2)">
          <input class="input" id="taskDue" type="date" aria-label="Échéance (optionnelle)">
          <select class="select" id="taskPrio" aria-label="Priorité">
            <option value="normale">Priorité normale</option>
            <option value="haute">Priorité haute</option>
            <option value="basse">Priorité basse</option>
          </select>
        </div>
        <button class="btn primary block cta" type="submit" style="margin-top:var(--sp-2)">Ajouter</button>
      </form>

      ${section("En retard", overdue, { badge: "neg" })}
      ${section("Aujourd'hui", dueToday)}
      ${section("À venir", upcoming)}
      ${
        doneRecent.length
          ? section("Terminées récemment", doneRecent) +
            `<button class="btn block ghost" id="clearDone" style="margin-top:var(--sp-2)">Effacer les tâches terminées</button>`
          : ""
      }
      ${!data.tasks.length ? `<p class="empty">Aucune tâche. La tête vide, c'est ici que ça se gagne.</p>` : ""}
    `;

    wrap.querySelector("#newTask").addEventListener("submit", (e) => {
      e.preventDefault();
      const title = clampString(wrap.querySelector("#taskTitle").value, 140);
      if (!isNonEmptyString(title, 140)) return;
      const due = wrap.querySelector("#taskDue").value;
      update((s) => {
        s.tasks.push({
          id: uid("tsk-"),
          title,
          due: isValidDateISO(due) ? due : null,
          priority: wrap.querySelector("#taskPrio").value,
          done: false,
          doneAt: null,
          createdAt: new Date().toISOString(),
          note: "",
        });
      });
    });

    wrap.querySelectorAll("[data-toggle]").forEach((b) =>
      b.addEventListener("click", () => {
        update((s) => {
          const t = s.tasks.find((x) => x.id === b.dataset.toggle);
          if (!t) return;
          t.done = !t.done;
          t.doneAt = t.done ? new Date().toISOString() : null;
        });
      })
    );

    wrap.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        update((s) => {
          s.tasks = s.tasks.filter((t) => t.id !== b.dataset.del);
        });
      })
    );

    wrap.querySelector("#clearDone")?.addEventListener("click", () => {
      update((s) => {
        s.tasks = s.tasks.filter((t) => !t.done);
      });
    });

    function section(title, list, opts = {}) {
      if (!list.length) return "";
      return `
        <h3 class="section-title">${title}
          ${opts.badge ? `<span class="badge ${opts.badge}">${list.length}</span>` : ""}
        </h3>
        <div class="list">${list.map(taskRow).join("")}</div>
      `;
    }

    function taskRow(t) {
      const late = !t.done && t.due && t.due < today;
      return `
        <div class="row ${t.done ? "done" : ""}">
          <button class="task-check ${t.done ? "on" : ""}" data-toggle="${t.id}"
            aria-pressed="${t.done}" aria-label="Basculer ${esc(t.title)}">✓</button>
          <div class="row-main" style="flex:1">
            <div class="row-title">${PRIO[t.priority] ? `<span class="prio-flag">${PRIO[t.priority]}</span> ` : ""}${esc(t.title)}</div>
            ${
              t.due
                ? `<div class="row-sub ${late ? "negative" : ""}">${late ? "En retard — " : ""}${esc(formatDate(t.due, { year: t.due.slice(0, 4) !== today.slice(0, 4) }))}</div>`
                : ""
            }
          </div>
          <button class="icon-btn danger" data-del="${t.id}" aria-label="Supprimer">✕</button>
        </div>`;
    }
  }
}

function prioRank(t) {
  return { haute: 0, normale: 1, basse: 2 }[t.priority] ?? 1;
}

import { getState, update, subscribe } from "../state.js";
import {
  uid,
  todayISO,
  currentMonth,
  formatDate,
  formatMonth,
  formatMoney,
  esc,
  parseNumber,
  parsePositive,
  clampString,
  isValidDateISO,
  sum,
} from "../utils.js";

let tab = "apercu"; // apercu | journal | budget | revenus
let month = currentMonth();

const PAYMENTS = ["Carte", "Prélèvement", "Virement", "Espèces", "Remboursé"];

export function render(container) {
  const wrap = document.createElement("div");
  container.appendChild(wrap);
  const unsub = subscribe(draw);
  draw();
  return unsub;

  function draw() {
    const data = getState();
    if (!data) return;

    wrap.innerHTML = `
      <header class="page-header">
        <p class="eyebrow">${esc(formatMonth(month))}</p>
        <h1>Budget</h1>
        <div class="tabbar" role="tablist">
          ${tabBtn("apercu", "Aperçu")}
          ${tabBtn("journal", "Journal")}
          ${tabBtn("budget", "Prévisionnel")}
          ${tabBtn("revenus", "Revenus")}
        </div>
      </header>
      <div class="field">
        <label class="label" for="monthPicker">Mois analysé</label>
        <input class="input" type="month" id="monthPicker" value="${month}">
      </div>
      <div id="finBody"></div>
    `;

    wrap.querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        tab = b.dataset.tab;
        draw();
      })
    );

    wrap.querySelector("#monthPicker").addEventListener("change", (e) => {
      if (/^\d{4}-\d{2}$/.test(e.target.value)) {
        month = e.target.value;
        draw();
      }
    });

    const body = wrap.querySelector("#finBody");
    if (tab === "journal") renderJournal(body, data);
    else if (tab === "budget") renderBudget(body, data);
    else if (tab === "revenus") renderRevenues(body, data);
    else renderOverview(body, data);
  }

  function tabBtn(id, label) {
    return `<button class="tab" role="tab" data-tab="${id}" aria-selected="${tab === id}">${label}</button>`;
  }
}

// --- Calculs partagés ------------------------------------------------------

function computeMonth(data, ym) {
  const tx = data.finance.transactions.filter((t) => t.date.startsWith(ym));
  const planned = sum(data.finance.postes, (p) => p.planned);
  const spent = sum(tx, (t) => t.amount);
  const income = sum(data.finance.revenues, (r) => r.amount);
  const fixed = sum(
    data.finance.postes.filter((p) => p.type === "fixe"),
    (p) => p.planned
  );
  const savings = sum(
    data.finance.postes.filter((p) => p.categoryId === "cat-epargne"),
    (p) => p.planned
  );

  const byCategory = data.finance.categories.map((cat) => {
    const catPlanned = sum(
      data.finance.postes.filter((p) => p.categoryId === cat.id),
      (p) => p.planned
    );
    const catSpent = sum(tx.filter((t) => t.categoryId === cat.id), (t) => t.amount);
    return {
      ...cat,
      planned: catPlanned,
      spent: catSpent,
      gap: catPlanned - catSpent,
      pct: catPlanned ? Math.round((catSpent / catPlanned) * 100) : null,
    };
  });

  return { tx, planned, spent, income, fixed, savings, byCategory };
}

// --- Aperçu ----------------------------------------------------------------

function renderOverview(root, data) {
  const m = computeMonth(data, month);
  const rest = m.income - m.planned;
  const savingsRate = m.income ? Math.round((m.savings / m.income) * 100) : 0;

  root.innerHTML = `
    <div class="card-grid cols-3">
      <div class="card">
        <div class="card-label">Revenus</div>
        <div class="card-value positive">${formatMoney(m.income)}</div>
      </div>
      <div class="card">
        <div class="card-label">Budget prévu</div>
        <div class="card-value">${formatMoney(m.planned)}</div>
      </div>
      <div class="card">
        <div class="card-label">Réel dépensé</div>
        <div class="card-value ${m.spent > m.planned ? "negative" : ""}">${formatMoney(m.spent)}</div>
      </div>
    </div>

    <div class="card-grid cols-3" style="margin-top:var(--sp-3)">
      <div class="card">
        <div class="card-label">Reste à vivre</div>
        <div class="card-value ${rest >= 0 ? "positive" : "negative"}">${formatMoney(rest)}</div>
        <div class="card-sub">revenus − prévu</div>
      </div>
      <div class="card">
        <div class="card-label">Charges fixes</div>
        <div class="card-value">${formatMoney(m.fixed)}</div>
      </div>
      <div class="card">
        <div class="card-label">Taux d'épargne</div>
        <div class="card-value">${savingsRate} %</div>
      </div>
    </div>

    ${upcomingDueHtml(data)}
    ${monthHistoryHtml(data)}

    <h3 class="section-title">Par catégorie — prévu / réel</h3>
    <div class="list">
      ${m.byCategory
        .map((c) => {
          const over = c.pct !== null && c.pct > 100;
          const width = c.pct === null ? 0 : Math.min(100, c.pct);
          return `
        <div class="card">
          <div class="row" style="border:0;padding:0;background:transparent">
            <div class="row-main"><div class="row-title">${esc(c.name)}</div></div>
            <div class="row-actions num ${over ? "negative" : "faint"}">
              ${formatMoney(c.spent)} / ${formatMoney(c.planned)}
            </div>
          </div>
          <div class="bar" style="margin-top:var(--sp-2)">
            <i class="${over ? "over" : ""}" style="width:${width}%"></i>
          </div>
        </div>`;
        })
        .join("")}
    </div>
  `;
}

// Prochains prélèvements : postes fixes avec un jour, montant > 0,
// classés par proximité par rapport à aujourd'hui (sur 30 jours glissants).
export function upcomingDue(data, limit = 5, refDate = new Date()) {
  const today = refDate.getDate();
  return data.finance.postes
    .filter((p) => p.type === "fixe" && p.dueDay && p.planned > 0)
    .map((p) => {
      let inDays = p.dueDay - today;
      if (inDays < 0) inDays += 30; // passé ce mois-ci -> le mois prochain
      return { ...p, inDays };
    })
    .sort((a, b) => a.inDays - b.inDays)
    .slice(0, limit);
}

function upcomingDueHtml(data) {
  const due = upcomingDue(data);
  if (!due.length) return "";
  return `
    <h3 class="section-title">Prochains prélèvements</h3>
    <div class="list">
      ${due
        .map(
          (p) => `
        <div class="row">
          <div class="due-day"><b>${p.dueDay}</b><span>du mois</span></div>
          <div class="row-main" style="flex:1">
            <div class="row-title">${esc(p.name)}</div>
            <div class="row-sub">${
              p.inDays === 0 ? "aujourd'hui" : p.inDays === 1 ? "demain" : `dans ${p.inDays} jours`
            }</div>
          </div>
          <span class="num">${formatMoney(p.planned)}</span>
        </div>`
        )
        .join("")}
    </div>`;
}

// Dépensé réel sur les 6 derniers mois (mois affiché inclus).
function monthHistoryHtml(data) {
  const months = [];
  const [y, m] = month.split("-").map(Number);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const ym = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    months.push({
      ym,
      label: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
      spent: sum(
        data.finance.transactions.filter((t) => t.date.startsWith(ym)),
        (t) => t.amount
      ),
    });
  }
  const max = Math.max(...months.map((x) => x.spent));
  if (max === 0) return "";
  return `
    <h3 class="section-title">Dépenses — 6 derniers mois</h3>
    <div class="card">
      <div class="mbars">
        ${months
          .map(
            (x) => `
          <div class="mbar ${x.ym === month ? "current" : ""}" title="${x.ym} : ${formatMoney(x.spent)}">
            <i style="height:${max ? Math.round((x.spent / max) * 100) : 0}%"></i>
            <span class="mbar-label">${esc(x.label)}</span>
          </div>`
          )
          .join("")}
      </div>
    </div>`;
}

// --- Journal des dépenses --------------------------------------------------

function renderJournal(root, data) {
  const tx = data.finance.transactions
    .filter((t) => t.date.startsWith(month))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  root.innerHTML = `
    <form class="form-card" id="txForm">
      <div class="form-grid">
        <input class="input" id="txDate" type="date" value="${todayISO()}" aria-label="Date" required>
        <input class="input" id="txAmount" type="text" inputmode="decimal" placeholder="Montant €" aria-label="Montant" required>
      </div>
      <div class="field" style="margin-top:var(--sp-2)">
        <select class="select" id="txCategory" aria-label="Catégorie">
          ${data.finance.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <select class="select" id="txPoste" aria-label="Poste"></select>
      </div>
      <div class="form-grid">
        <input class="input" id="txLabel" type="text" maxlength="120" placeholder="Libellé" aria-label="Libellé">
        <select class="select" id="txPayment" aria-label="Moyen de paiement">
          ${PAYMENTS.map((p) => `<option value="${p}">${p}</option>`).join("")}
        </select>
      </div>
      <button class="btn primary block cta" type="submit" style="margin-top:var(--sp-3)">Ajouter la dépense</button>
    </form>

    <h3 class="section-title">${tx.length} dépense${tx.length > 1 ? "s" : ""} — total ${formatMoney(
    sum(tx, (t) => t.amount)
  )}</h3>
    <div class="list" id="txList"></div>
  `;

  const catSel = root.querySelector("#txCategory");
  const posteSel = root.querySelector("#txPoste");

  function fillPostes() {
    const list = data.finance.postes.filter((p) => p.categoryId === catSel.value);
    posteSel.innerHTML = list.length
      ? list.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")
      : `<option value="">— aucun poste —</option>`;
  }
  catSel.addEventListener("change", fillPostes);
  fillPostes();

  root.querySelector("#txForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const date = root.querySelector("#txDate").value;
    const amount = parsePositive(root.querySelector("#txAmount").value);
    if (!isValidDateISO(date)) return toast("Date invalide.", true);
    if (amount === null) return toast("Montant invalide : saisis un nombre positif.", true);

    update((s) => {
      s.finance.transactions.push({
        id: uid("tx-"),
        date,
        categoryId: catSel.value,
        posteId: posteSel.value || "",
        label: clampString(root.querySelector("#txLabel").value, 120),
        amount,
        payment: root.querySelector("#txPayment").value,
        note: "",
      });
    });
    root.querySelector("#txAmount").value = "";
    root.querySelector("#txLabel").value = "";
  });

  const list = root.querySelector("#txList");
  if (!tx.length) {
    list.innerHTML = `<p class="empty">Aucune dépense enregistrée sur ${esc(formatMonth(month))}.</p>`;
    return;
  }

  list.innerHTML = tx
    .map((t) => {
      const poste = data.finance.postes.find((p) => p.id === t.posteId);
      const cat = data.finance.categories.find((c) => c.id === t.categoryId);
      return `
      <div class="row">
        <div class="row-main">
          <div class="row-title">${esc(t.label || poste?.name || cat?.name || "Dépense")}</div>
          <div class="row-sub">${formatDate(t.date)} · ${esc(poste?.name || "—")} · ${esc(t.payment)}</div>
        </div>
        <div class="row-actions">
          <span class="num">${formatMoney(t.amount)}</span>
          <button class="icon-btn danger" data-del="${t.id}" aria-label="Supprimer">✕</button>
        </div>
      </div>`;
    })
    .join("");

  list.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      update((s) => {
        s.finance.transactions = s.finance.transactions.filter((t) => t.id !== b.dataset.del);
      });
    })
  );
}

// --- Prévisionnel ----------------------------------------------------------

function renderBudget(root, data) {
  const total = sum(data.finance.postes, (p) => p.planned);
  const fixed = sum(data.finance.postes.filter((p) => p.type === "fixe"), (p) => p.planned);
  const variable = total - fixed;

  root.innerHTML = `
    <div class="card-grid cols-3">
      <div class="card"><div class="card-label">Total prévu</div><div class="card-value">${formatMoney(total)}</div></div>
      <div class="card"><div class="card-label">Fixes</div><div class="card-value">${formatMoney(fixed)}</div></div>
      <div class="card"><div class="card-label">Variables</div><div class="card-value">${formatMoney(variable)}</div></div>
    </div>
    <p class="card-sub" style="margin-top:var(--sp-3)">
      Modifie un montant pour ajuster le prévisionnel. Il s'applique à tous les mois.
    </p>
    <div id="budgetBody"></div>
  `;

  const body = root.querySelector("#budgetBody");
  data.finance.categories.forEach((cat) => {
    const postes = data.finance.postes.filter((p) => p.categoryId === cat.id);
    if (!postes.length) return;
    const catTotal = sum(postes, (p) => p.planned);

    const tag = document.createElement("p");
    tag.className = "block-tag";
    tag.textContent = `${cat.name} — ${formatMoney(catTotal)}`;
    body.appendChild(tag);

    const list = document.createElement("div");
    list.className = "list";
    list.innerHTML = postes
      .map(
        (p) => `
      <div class="row">
        <div class="row-main">
          <div class="row-title">${esc(p.name)}</div>
          <div class="row-sub">${p.type === "fixe" ? "Fixe" : "Variable"}${
          p.dueDay ? ` · le ${p.dueDay}` : ""
        }${p.note ? ` · ${esc(p.note)}` : ""}</div>
        </div>
        <div class="row-actions">
          <input class="input compact" type="text" inputmode="decimal"
            value="${p.planned || ""}" placeholder="0"
            aria-label="Montant prévu — ${esc(p.name)}" data-poste="${p.id}">
        </div>
      </div>`
      )
      .join("");
    body.appendChild(list);
  });

  body.querySelectorAll("[data-poste]").forEach((input) =>
    input.addEventListener("change", () => {
      const value = parseNumber(input.value);
      if (value === null && input.value.trim() !== "") {
        toast("Montant invalide.", true);
        return;
      }
      update((s) => {
        const p = s.finance.postes.find((x) => x.id === input.dataset.poste);
        if (p) p.planned = value ?? 0;
      });
    })
  );
}

// --- Revenus ---------------------------------------------------------------

function renderRevenues(root, data) {
  const total = sum(data.finance.revenues, (r) => r.amount);

  root.innerHTML = `
    <div class="card">
      <div class="card-label">Total des revenus</div>
      <div class="card-value positive">${formatMoney(total)}</div>
    </div>
    <div class="list" style="margin-top:var(--sp-3)">
      ${data.finance.revenues
        .map(
          (r) => `
        <div class="row">
          <div class="row-main"><div class="row-title">${esc(r.name)}</div></div>
          <div class="row-actions">
            <input class="input compact" type="text" inputmode="decimal"
              value="${r.amount || ""}" placeholder="0"
              aria-label="Montant — ${esc(r.name)}" data-rev="${r.id}">
          </div>
        </div>`
        )
        .join("")}
    </div>
  `;

  root.querySelectorAll("[data-rev]").forEach((input) =>
    input.addEventListener("change", () => {
      const value = parseNumber(input.value);
      if (value === null && input.value.trim() !== "") return toast("Montant invalide.", true);
      update((s) => {
        const r = s.finance.revenues.find((x) => x.id === input.dataset.rev);
        if (r) r.amount = value ?? 0;
      });
    })
  );
}

function toast(msg, isError) {
  window.dispatchEvent(new CustomEvent("jarvis:toast", { detail: { msg, isError } }));
}

import { init, onSaveError, getState, subscribe } from "./state.js";
import { registerRoute, startRouter } from "./router.js";
import { initTimer } from "./components/timer.js";
import * as dashboard from "./modules/dashboard.js";
import * as sport from "./modules/sport.js";
import * as finance from "./modules/finance.js";
import * as habits from "./modules/habits.js";
import * as tasks from "./modules/tasks.js";
import * as nutrition from "./modules/nutrition.js";
import * as settings from "./modules/settings.js";

async function boot() {
  const root = document.getElementById("app");
  const bootEl = document.getElementById("boot");

  try {
    await init();
  } catch (err) {
    console.error(err);
    if (bootEl) {
      bootEl.textContent = "Impossible de charger les données : " + (err.message || err);
    }
    return;
  }

  bootEl?.remove();

  initTimer();

  registerRoute("#/", dashboard.render);
  registerRoute("#/sport", sport.render);
  registerRoute("#/finance", finance.render);
  registerRoute("#/habits", habits.render);
  registerRoute("#/tasks", tasks.render);
  registerRoute("#/nutrition", nutrition.render);
  registerRoute("#/settings", settings.render);
  registerRoute("#/404", (c) => {
    c.innerHTML = `<div class="page-header"><h1>Introuvable</h1></div>
      <p class="empty">Cette page n'existe pas. <a href="#/">Retour à l'accueil</a></p>`;
  });

  buildNav();
  subscribe(buildNav); // la nav suit les onglets activés dans les Réglages

  startRouter(root);

  window.addEventListener("jarvis:toast", (e) => showToast(e.detail.msg, e.detail.isError));
  onSaveError((err) => showToast("Enregistrement impossible : " + (err.message || err), true));

  registerServiceWorker();
}

// Onglets disponibles. L'accueil est toujours présent : c'est le point
// d'entrée, et sans lui l'app n'aurait plus de page d'atterrissage.
const NAV_ITEMS = [
  { key: null, href: "#/", icon: "◍", label: "Accueil" },
  { key: "sport", href: "#/sport", icon: "◆", label: "Sport" },
  { key: "nutrition", href: "#/nutrition", icon: "◐", label: "Nutrition" },
  { key: "finance", href: "#/finance", icon: "▤", label: "Budget" },
  { key: "habits", href: "#/habits", icon: "✓", label: "Habitudes" },
  { key: "tasks", href: "#/tasks", icon: "☰", label: "Tâches" },
];

let lastNavSignature = "";

function buildNav() {
  const nav = document.getElementById("nav");
  const tabs = getState()?.tabs || {};
  const visible = NAV_ITEMS.filter((i) => !i.key || tabs[i.key] !== false);
  const signature = visible.map((i) => i.href).join("|");
  if (!nav || signature === lastNavSignature) return;
  lastNavSignature = signature;

  nav.innerHTML = visible
    .map(
      (i) =>
        `<a href="${i.href}" data-nav-link><span class="nav-icon" aria-hidden="true">${i.icon}</span><span>${i.label}</span></a>`
    )
    .join("");

  // Si l'onglet ouvert vient d'être masqué, on ramène à l'accueil.
  const current = (location.hash || "#/").split("?")[0];
  const stillThere = visible.some((i) => i.href === current) || current === "#/settings";
  if (!stillThere) location.hash = "#/";
  else document.querySelectorAll("[data-nav-link]").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("href") === current);
  });
}

let toastTimer = null;
function showToast(message, isError = false) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle("error", Boolean(isError));
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}

function registerServiceWorker() {
  // En file:// il n'y a pas de service worker : l'app fonctionne quand même,
  // simplement sans cache hors-ligne.
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("./sw.js").catch((err) => {
    console.warn("Service worker non enregistré", err);
  });
}

boot();

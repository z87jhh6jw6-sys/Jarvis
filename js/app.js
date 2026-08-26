import { init, onSaveError } from "./state.js";
import { registerRoute, startRouter } from "./router.js";
import { initTimer } from "./components/timer.js";
import * as dashboard from "./modules/dashboard.js";
import * as sport from "./modules/sport.js";
import * as finance from "./modules/finance.js";
import * as habits from "./modules/habits.js";
import * as tasks from "./modules/tasks.js";
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
  registerRoute("#/settings", settings.render);
  registerRoute("#/404", (c) => {
    c.innerHTML = `<div class="page-header"><h1>Introuvable</h1></div>
      <p class="empty">Cette page n'existe pas. <a href="#/">Retour à l'accueil</a></p>`;
  });

  startRouter(root);

  window.addEventListener("jarvis:toast", (e) => showToast(e.detail.msg, e.detail.isError));
  onSaveError((err) => showToast("Enregistrement impossible : " + (err.message || err), true));

  registerServiceWorker();
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

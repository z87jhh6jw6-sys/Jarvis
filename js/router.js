// Routeur à hash minimal. Chaque route rend dans le conteneur et peut
// renvoyer une fonction de nettoyage (désabonnements, timers).

const routes = new Map();
let container = null;
let cleanup = null;

// Direction artistique par route (voir tokens.css).
const THEMES = {
  "#/": "home",
  "#/sport": "sport",
  "#/finance": "budget",
  "#/habits": "habits",
  "#/nutrition": "nutrition",
  "#/tasks": "tasks",
  "#/settings": "settings",
};

export function registerRoute(path, render) {
  routes.set(path, render);
}

export function startRouter(rootEl, fallback = "#/") {
  container = rootEl;
  window.addEventListener("hashchange", handleRoute);
  if (!location.hash) location.hash = fallback;
  handleRoute();
}

function currentPath() {
  return (location.hash || "#/").split("?")[0];
}

async function handleRoute() {
  const path = currentPath();
  const render = routes.get(path) || routes.get("#/404");

  if (typeof cleanup === "function") {
    try {
      cleanup();
    } catch (err) {
      console.error("Erreur au nettoyage de la route", err);
    }
    cleanup = null;
  }

  container.innerHTML = "";
  markActive(path);
  document.body.dataset.theme = THEMES[path] || "home";
  window.scrollTo(0, 0);

  if (render) cleanup = await render(container);
}

function markActive(path) {
  document.querySelectorAll("[data-nav-link]").forEach((el) => {
    const active = el.getAttribute("href") === path;
    el.classList.toggle("active", active);
    if (active) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
}

export function navigate(path) {
  location.hash = path;
}

import { getState, replaceState, update } from "../state.js";
import {
  supportsFileAccess,
  getBackend,
  getFileName,
  linkNewFile,
  linkExistingFile,
  unlinkFile,
  reloadFromFile,
  exportToFile,
  importFromFile,
} from "../storage.js";
import { esc, sum, parseNumber } from "../utils.js";
import {
  ACTIVITY_LEVELS,
  GOALS,
  basalRate,
  maintenance,
  computeTargets,
  effectiveTargets,
  isProfileComplete,
} from "../profile.js";

const TAB_LABELS = {
  sport: "Sport",
  nutrition: "Nutrition",
  finance: "Budget",
  habits: "Habitudes",
  tasks: "Tâches",
};

export function render(container) {
  const wrap = document.createElement("div");
  container.appendChild(wrap);
  draw();
  return () => {};

  function draw() {
    const data = getState();
    const backend = getBackend();
    const linked = backend === "fichier";

    const counts = {
      sessions: data.sport.sessions.length,
      weighIns: data.sport.weighIns.length,
      transactions: data.finance.transactions.length,
      habits: data.habits.habits.length,
      checkins: data.habits.checkins.length,
    };

    wrap.innerHTML = `
      <header class="page-header"><h1>Réglages</h1></header>

      <div class="card">
        <div class="card-label">Mon profil</div>
        <p class="card-sub" style="margin-bottom:var(--sp-3)">
          Sert à estimer tes besoins journaliers en calories, protéines et eau.
        </p>
        <div class="form-grid">
          <select class="select" id="pSex" aria-label="Sexe">
            <option value="homme">Homme</option>
            <option value="femme">Femme</option>
          </select>
          <input class="input" id="pAge" type="text" inputmode="numeric" placeholder="Âge" aria-label="Âge">
        </div>
        <div class="form-grid" style="margin-top:var(--sp-2)">
          <input class="input" id="pHeight" type="text" inputmode="decimal" placeholder="Taille (cm)" aria-label="Taille en centimètres">
          <input class="input" id="pWeight" type="text" inputmode="decimal" placeholder="Poids (kg)" aria-label="Poids en kilos">
        </div>
        <div class="form-grid" style="margin-top:var(--sp-2)">
          <input class="input" id="pTarget" type="text" inputmode="decimal" placeholder="Poids visé (kg)" aria-label="Poids visé en kilos">
        </div>
        <label class="label" style="margin-top:var(--sp-3)">Niveau d'activité</label>
        <select class="select" id="pActivity" aria-label="Niveau d'activité">
          ${ACTIVITY_LEVELS.map((a) => `<option value="${a.id}">${esc(a.label)}</option>`).join("")}
        </select>
        <label class="label" style="margin-top:var(--sp-3)">Objectif</label>
        <select class="select" id="pGoal" aria-label="Objectif">
          ${GOALS.map((g) => `<option value="${g.id}">${esc(g.label)}</option>`).join("")}
        </select>
        <div id="pResult" style="margin-top:var(--sp-4)"></div>
      </div>

      <div class="card" style="margin-top:var(--sp-3)">
        <div class="card-label">Onglets affichés</div>
        <p class="card-sub" style="margin-bottom:var(--sp-3)">
          Masque ce qui ne te sert pas. Les données ne sont pas effacées :
          réactiver l'onglet les fait réapparaître.
        </p>
        <div id="tabToggles"></div>
      </div>

      <div class="card" style="margin-top:var(--sp-3)">
        <div class="card-label">Stockage</div>
        <div class="card-value" style="font-size:var(--fs-md)">
          ${linked ? "Fichier lié" : "Stockage local"}
        </div>
        <div class="card-sub">
          ${
            linked
              ? `Écriture directe dans <span class="mono">${esc(getFileName())}</span> à chaque modification.`
              : `Les données vivent dans l'app, sur cet appareil. Utilise Exporter pour les déposer dans iCloud Drive.`
          }
        </div>
      </div>

      ${
        supportsFileAccess
          ? `
      <div class="card" style="margin-top:var(--sp-3)">
        <div class="card-label">Fichier de données</div>
        <p class="card-sub" style="margin-bottom:var(--sp-3)">
          Désigne un <span class="mono">jarvis-data.json</span> dans ton dossier iCloud Drive.
          macOS se charge ensuite de la synchronisation.
        </p>
        <button class="btn block" id="linkNew">Créer un nouveau fichier lié</button>
        <button class="btn block" id="linkExisting" style="margin-top:var(--sp-2)">Lier un fichier existant</button>
        ${
          linked
            ? `<button class="btn block" id="reload" style="margin-top:var(--sp-2)">Recharger depuis le fichier</button>
               <button class="btn block ghost" id="unlink" style="margin-top:var(--sp-2)">Délier</button>`
            : ""
        }
      </div>`
          : `
      <div class="card" style="margin-top:var(--sp-3)">
        <div class="card-label">Pourquoi pas de fichier lié ici</div>
        <p class="card-sub">
          Safari — sur iPhone comme sur Mac — ne permet pas à une app web d'écrire
          directement dans un fichier du disque, même installée sur l'écran d'accueil.
          C'est une limite du navigateur. La synchronisation vers iCloud Drive passe
          donc par les boutons Exporter / Importer ci-dessous.
        </p>
      </div>`
      }

      <div class="card" style="margin-top:var(--sp-3)">
        <div class="card-label">Sauvegarde &amp; transfert iCloud</div>
        <p class="card-sub" style="margin-bottom:var(--sp-3)">
          <strong>Envoyer</strong> crée le fichier de tes données : range-le dans iCloud Drive
          (sur iPhone : « Enregistrer dans Fichiers » → iCloud Drive).
          <strong>Récupérer</strong> relit ce fichier pour retrouver tes données sur l'autre appareil.
        </p>
        <button class="btn primary block cta" id="export">
          Envoyer mes données vers iCloud
        </button>
        <label class="btn block" for="importInput" style="margin-top:var(--sp-2)">
          Récupérer depuis iCloud…
        </label>
        <input type="file" id="importInput" accept="application/json,.json" hidden>
        <p class="card-sub negative" style="margin-top:var(--sp-2)">
          « Récupérer » remplace tout ce qui est actuellement dans l'app.
        </p>
      </div>

      <div class="card" style="margin-top:var(--sp-3)">
        <div class="card-label">Contenu</div>
        <div class="card-sub">${counts.sessions} séance(s) · ${counts.weighIns} pesée(s)</div>
        <div class="card-sub">${counts.transactions} dépense(s) · ${
      data.finance.postes.length
    } poste(s) budgétaire(s) · ${formatTotalPlanned(data)} prévus / mois</div>
        <div class="card-sub">${counts.habits} habitude(s) · ${counts.checkins} check-in(s)</div>
      </div>

      <div class="card" style="margin-top:var(--sp-3)">
        <div class="card-label">À propos</div>
        <p class="card-sub">
          Application locale : aucun compte, aucun serveur, aucune télémétrie,
          aucune dépendance externe. Fonctionne hors-ligne après le premier chargement.
        </p>
      </div>
    `;

    // --- profil ---
    const prof = data.profile;
    const setVal = (sel, v) => { const el = wrap.querySelector(sel); if (el) el.value = v ?? ""; };
    setVal("#pSex", prof.sex);
    setVal("#pAge", prof.age);
    setVal("#pHeight", prof.heightCm);
    setVal("#pWeight", prof.weightKg);
    setVal("#pTarget", prof.targetWeightKg);
    setVal("#pActivity", prof.activity);
    setVal("#pGoal", prof.goal);
    drawTargets();

    ["#pSex", "#pAge", "#pHeight", "#pWeight", "#pTarget", "#pActivity", "#pGoal"].forEach((sel) =>
      wrap.querySelector(sel).addEventListener("change", saveProfile)
    );

    function saveProfile() {
      update((s) => {
        const p = s.profile;
        p.sex = wrap.querySelector("#pSex").value;
        p.age = parseNumber(wrap.querySelector("#pAge").value);
        p.heightCm = parseNumber(wrap.querySelector("#pHeight").value);
        p.weightKg = parseNumber(wrap.querySelector("#pWeight").value);
        p.targetWeightKg = parseNumber(wrap.querySelector("#pTarget").value);
        p.activity = wrap.querySelector("#pActivity").value;
        p.goal = wrap.querySelector("#pGoal").value;
        const auto = computeTargets(p);
        if (auto && p.auto !== false) p.targets = auto;
      });
      drawTargets();
    }

    function drawTargets() {
      const p = getState().profile;
      const box = wrap.querySelector("#pResult");
      if (!box) return;
      if (!isProfileComplete(p)) {
        box.innerHTML = `<p class="card-sub">Renseigne âge, taille et poids pour obtenir une estimation.</p>`;
        return;
      }
      const t = effectiveTargets(p);
      box.innerHTML = `
        <div class="card-grid cols-3">
          <div class="card"><div class="card-label">Calories</div><div class="card-value">${t.kcal}</div></div>
          <div class="card"><div class="card-label">Protéines</div><div class="card-value">${t.protein} g</div></div>
          <div class="card"><div class="card-label">Eau</div><div class="card-value">${(t.waterMl / 1000).toFixed(1).replace(".", ",")} L</div></div>
        </div>
        <p class="card-sub" style="margin-top:var(--sp-3)">
          Métabolisme de base estimé ${basalRate(p)} kcal, dépense totale ${maintenance(p)} kcal.
          C'est une estimation statistique, pas une mesure : suis ton poids deux à trois
          semaines et ajuste de 200 kcal si la balance ne va pas dans le sens voulu.
        </p>`;
    }

    // --- onglets affichés ---
    const togglesBox = wrap.querySelector("#tabToggles");
    togglesBox.innerHTML = Object.keys(TAB_LABELS)
      .map(
        (key) => `<label class="fav-check" style="justify-content:space-between">
          <span>${esc(TAB_LABELS[key])}</span>
          <input type="checkbox" data-tab="${key}" ${data.tabs[key] !== false ? "checked" : ""}>
        </label>`
      )
      .join("");
    togglesBox.querySelectorAll("[data-tab]").forEach((cb) =>
      cb.addEventListener("change", () => {
        const on = cb.checked;
        const key = cb.dataset.tab;
        const remaining = Object.keys(TAB_LABELS).filter(
          (k) => (k === key ? on : getState().tabs[k] !== false)
        );
        if (!remaining.length) {
          cb.checked = true;
          return toast("Il faut garder au moins un onglet.", true);
        }
        update((s) => { s.tabs[key] = on; });
      })
    );

    if (supportsFileAccess) {
      bind("#linkNew", async () => {
        const data = await linkNewFile(getState());
        replaceState(data, { persist: false });
        toast("Fichier créé et lié.");
        draw();
      });
      bind("#linkExisting", async () => {
        const data = await linkExistingFile();
        replaceState(data, { persist: false });
        toast("Fichier lié.");
        draw();
      });
      bind("#reload", async () => {
        const data = await reloadFromFile();
        replaceState(data, { persist: false });
        toast("Données rechargées depuis le fichier.");
        draw();
      });
      bind("#unlink", async () => {
        await unlinkFile();
        toast("Fichier délié. Les données restent dans l'app.");
        draw();
      });
    }

    wrap.querySelector("#export").addEventListener("click", () => {
      exportToFile(getState());
      toast("Export généré.");
    });

    wrap.querySelector("#importInput").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!confirm("Remplacer toutes les données actuelles par ce fichier ?")) {
        e.target.value = "";
        return;
      }
      try {
        const data = await importFromFile(file);
        replaceState(data);
        toast("Import réussi.");
        draw();
      } catch (err) {
        toast(err.message || String(err), true);
      } finally {
        e.target.value = "";
      }
    });

    function bind(sel, handler) {
      const el = wrap.querySelector(sel);
      if (!el) return;
      el.addEventListener("click", async () => {
        try {
          await handler();
        } catch (err) {
          // L'utilisateur qui ferme le sélecteur de fichier n'est pas une erreur.
          if (err?.name === "AbortError") return;
          toast(err.message || String(err), true);
        }
      });
    }
  }
}

function formatTotalPlanned(data) {
  const total = sum(data.finance.postes, (p) => p.planned);
  return total.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function toast(msg, isError) {
  window.dispatchEvent(new CustomEvent("jarvis:toast", { detail: { msg, isError } }));
}

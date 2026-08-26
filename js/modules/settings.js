import { getState, replaceState } from "../state.js";
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
import { esc, sum } from "../utils.js";

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

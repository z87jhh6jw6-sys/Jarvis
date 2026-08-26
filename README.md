# Jarvis

Application personnelle locale : sport, budget, habitudes, tâches.
HTML/CSS/JS vanilla, modules ES natifs. Pas de build, pas de dépendance, pas de serveur, pas de compte, pas de télémétrie. Fonctionne hors-ligne après le premier chargement.

## Lancer en local

Le service worker exige `http://` — en `file://` l'app s'affiche mais sans cache hors-ligne.

```bash
cd Jarvis
python3 -m http.server 8080
```

Puis `http://localhost:8080`.

## Structure

```
Jarvis/
  index.html
  manifest.json
  sw.js                     cache hors-ligne
  css/
    tokens.css              ← LE fichier à modifier pour restyler
    styles.css              composants (ne lit que les tokens)
  js/
    app.js                  amorçage, routes, toasts
    router.js               routeur à hash
    state.js                store + persistance groupée
    storage.js              backends de stockage
    schema.js               forme des données + validation
    seed.js                 référentiel importé de tes fichiers existants
    idb.js                  wrapper IndexedDB
    utils.js                helpers + validation d'entrées
    components/timer.js     minuteur de repos
    components/ring.js      anneaux de progression
    modules/                dashboard, sport, finance, habits, tasks, settings
  data/
    jarvis-data.example.json  exemple du format
  icons/
```

## Design : clair crème + thème coloré fort par onglet

Fond crème chaleureux (`#f2f0ea`) lui-même légèrement teinté par l'onglet actif, cartes quasi blanches (7 % de teinte) aux coins très arrondis qui flottent à l'ombre douce, chacune signée d'un liseré de 3 px couleur du thème sur le bord gauche — on reconnaît la page même sur une carte isolée. Texte anthracite à fort contraste, typo système en graisse forte (860), nav flottante en verre clair, anneaux SVG sur l'accueil.

Chaque onglet est un vrai thème affirmé, posé par le routeur via `data-theme` et la seule variable `--c-brand` : Accueil bleu électrique `#2f5fe0`, Sport ambre brûlé `#b5600c`, Budget vert sapin `#33664d`, Habitudes violet `#7048d6`, Tâches corail terre `#d14a33`, Réglages anthracite. Teintes recalibrées pour le fond clair (plus profondes que les versions du mode sombre) et vérifiées programmatiquement : blanc-sur-couleur ≥ 4.4:1 partout, texte courant ~16:1. La couleur est présente en blocs pleins — hero « Priorité du moment », pastilles d'échéance, cercles-flèches, CTA, badges, onglets actifs — en plus des titres, courbes, barres et anneaux. Textes secondaires teintés à ~30–35 %. Sur le tableau de bord, chaque anneau garde la couleur de **son** module.

Le rouge critique (`#c62828`) reste réservé aux retards/dépassements (le hero passe en rouge plein si une tâche est en retard) ; le corail des Tâches, plus orangé, en reste distinct. Tout est dans **`css/tokens.css`**.

Les polices sont **système uniquement** (`-apple-system` / `ui-monospace`) : aucun chargement réseau, rendu natif iOS et macOS, mode hors-ligne intact.

## Ce qui a été repris de tes fichiers existants

**`jarvis-module-sport.html`** → `js/seed.js`

- Programme *Bloc 1 — Priorité masse*, 12 semaines, 3 séances/semaine.
- Les 3 jours avec leurs 22 exercices, schémas de séries, notes techniques et temps de repos (les repos étaient écrits en toutes lettres dans les titres de blocs — « repos 3 min », « repos 90 s » — ils ont été convertis en secondes).
- Poids de corps : départ 60 kg, cible 64 kg (seule valeur personnelle encore présente dans le code, faute d'écran pour la régler — dis-le si tu veux la retirer).
- Le minuteur de repos avec écran maintenu allumé et vibration de fin (silencieux, pensé pour la salle).

Deux différences avec l'original, volontaires :

- L'ancien fichier ne gardait qu'une seule valeur par exercice (la dernière charge). Ici cette valeur existe toujours (affichée en « Dernière charge »), mais chaque séance enregistrée est en plus archivée dans un historique daté.
- Le minuteur recalcule le temps restant depuis l'horloge à chaque tick au lieu de décrémenter un compteur. Sur iPhone, `setInterval` est gelé quand l'écran se verrouille : l'ancienne version « perdait » le temps écoulé pendant le verrouillage.

L'onglet *Cuisine* (liste de courses 76 €/mois, journée type, remarques sur les chèques repas) n'a **pas** été repris — c'est du contenu de référence statique, pas un module avec des données à saisir. Dis-moi si tu le veux comme page.

**`budget-mensuel.xlsx`** → `js/seed.js`

- 9 catégories, 28 postes budgétaires avec leur type fixe/variable, jour de prélèvement et notes.
- Les 4 lignes de revenus.
- **Les montants ne sont volontairement pas embarqués** : postes et revenus sont livrés à zéro, pour qu'aucun chiffre personnel ne se retrouve dans un dépôt public. Ils se saisissent une fois dans l'app (onglets Prévisionnel et Revenus) et vivent ensuite uniquement dans ton fichier de données.

Le Journal du tableur ne contenait qu'une ligne d'exemple, donc aucune dépense réelle n'a été migrée. Les formules `SUMIFS` du tableau de bord sont remplacées par du calcul en JavaScript : sélection du mois, prévu/réel/écart par catégorie, taux d'épargne.

**Habitudes** : aucun fichier existant, module parti de zéro — check-in du jour, série en cours et record, objectif hebdomadaire optionnel (ex. 3×/semaine), grille 4 semaines, archivage.

## Fonctionnalités "assistant"

- **Accueil = plan d'action du jour.** Un bloc « Priorité du moment » choisit la première chose à faire (tâche en retard > séance prévue > tâche du jour > habitude restante), suivi de la liste du jour : séance prévue selon le jour de la semaine (mardi/jeudi/vendredi), habitudes restantes, tâches dues, prélèvement imminent (≤ 3 jours). Réglages accessibles par le bouton « ⚙ Réglages » en haut de l'accueil.
- **Tâches** : nouvel onglet — échéances, priorités, détection des retards, sections En retard / Aujourd'hui / À venir, nettoyage des terminées.
- **Sport** : compteur « semaine X/12 » (démarré à la première séance enregistrée), onglet Progression avec courbe par exercice (SVG maison, zéro dépendance), badge PR sur les records, delta depuis la première charge.
- **Budget** : « Prochains prélèvements » calculés depuis les jours de prélèvement de tes postes fixes, histogramme des dépenses sur 6 mois.
- **Habitudes** : objectifs hebdomadaires avec badge de progression, record de série.

## Stockage des données

Tout vit dans **un seul document JSON** (`jarvis-data.json`) — voir `data/jarvis-data.example.json`. Deux backends, choisis automatiquement :

**Chrome / Edge sur Mac** — File System Access API. Dans Réglages, tu désignes un vrai fichier, typiquement dans un dossier iCloud Drive. Chaque modification s'y écrit directement ; macOS gère la synchronisation. Rien dans le code n'est spécifique à iCloud : c'est un dossier comme un autre, le chemin est choisi au moment du clic.

**Safari (Mac et iPhone)** — Safari ne permet pas à une app web d'écrire dans un fichier du disque, **même installée sur l'écran d'accueil**. C'est une limite d'Apple. Les données restent dans l'app (IndexedDB) et la synchro passe par les boutons **Envoyer mes données vers iCloud** / **Récupérer depuis iCloud** des Réglages.

En pratique, avec un usage quotidien sur iPhone : stockage interne comme base, « Envoyer vers iCloud » de temps en temps, et le Mac sous Chrome si tu veux l'écriture directe dans le fichier. C'est le compromis maximal qu'une PWA permet aujourd'hui sur iOS ; une vraie synchro transparente demanderait une app native ou un petit serveur, ce que tu as explicitement exclu.

Le fichier n'est jamais écrasé en silence : si le JSON lu est illisible, l'app affiche une erreur au lieu d'écrire par-dessus.

## Héberger gratuitement (GitHub Pages)

Pour installer l'app sur iPhone sans dépendre du Mac allumé, le **code** doit être servi en https. Tout est prêt : le workflow `.github/workflows/deploy.yml` publie le dossier tel quel sur GitHub Pages à chaque envoi.

### Méthode simple (recommandée) — GitHub Desktop

1. Créer un compte sur [github.com](https://github.com) (gratuit).
2. Installer [GitHub Desktop](https://desktop.github.com) et s'y connecter.
3. Menu **File → Add Local Repository**, choisir le dossier `Jarvis` — il est déjà reconnu comme dépôt, rien à préparer.
4. Cliquer **Publish repository**. Laisser le nom `Jarvis`, décocher « Keep this code private » (Pages gratuit exige un dépôt public — le code ne contient aucune donnée personnelle, voir plus bas).
5. Sur github.com, ouvrir le dépôt → **Settings → Pages → Source : "GitHub Actions"**.

Après une ou deux minutes (onglet **Actions**), l'app est en ligne sur `https://<TON_USER>.github.io/Jarvis/`.

Pour publier une modification plus tard : rouvrir GitHub Desktop, écrire une phrase dans « Summary », **Commit to main**, puis **Push origin**. Le site se met à jour tout seul.

### Méthode ligne de commande (si tu préfères)

```bash
cd ~/Jarvis
git remote add origin https://github.com/<TON_USER>/Jarvis.git
git push -u origin main
```

Puis **Settings → Pages → Source : "GitHub Actions"**. Note : `git push` en https demande un jeton d'accès personnel, pas le mot de passe du compte — d'où la recommandation de GitHub Desktop.

Tous les chemins de l'app sont relatifs (`./`), vérifiés en simulation sous sous-chemin : manifest, service worker et icônes fonctionnent tels quels sous `/Jarvis/`.

**Vie privée.** Seul le CODE part sur GitHub. Les données saisies (séances, dépenses,
habitudes, tâches) restent à 100 % sur l'appareil : fichier `jarvis-data.json` rangé dans
iCloud Drive, ou stockage interne du navigateur. Ce fichier est exclu du dépôt par
`.gitignore`. Le référentiel livré (`js/seed.js`) ne contient aucun montant : postes
budgétaires et revenus sont à zéro, à saisir dans l'app. Un dépôt public n'expose donc
que le programme d'entraînement et des noms de catégories.

## Installer sur iPhone

1. Ouvrir l'URL de l'app dans **Safari** (l'ajout à l'écran d'accueil ne marche que depuis Safari sur iOS) — idéalement l'URL GitHub Pages ci-dessus, sinon le Mac sur le même Wi-Fi (`http://<ip-du-mac>:8080`, mais l'app ne sera alors joignable que Mac allumé).
2. Partager → **Sur l'écran d'accueil**.

L'app s'ouvre alors en plein écran, sans barre Safari, et fonctionne hors-ligne.

## Installer sur Mac

- **Safari** : Fichier → Ajouter au Dock.
- **Chrome / Edge** : icône d'installation dans la barre d'adresse. À privilégier si tu veux le fichier lié à iCloud Drive.

## Sécurité

- Aucune dépendance externe, aucun CDN, aucune police distante : rien à auditer côté chaîne d'approvisionnement, et aucune requête sortante.
- Aucune télémétrie, aucun cookie, aucun compte.
- Toute donnée entrante est validée (`js/utils.js`) et normalisée (`js/schema.js`) : dates ISO réellement valides, montants numériques positifs, chaînes bornées. Une entrée invalide est écartée plutôt que d'être stockée.
- Le texte saisi est échappé avant insertion dans le DOM (`esc()`), donc une note d'exercice ou un libellé de dépense ne peut pas injecter de HTML.
- Les valeurs numériques acceptent la virgule française (`62,5`) comme le point.

## Tests effectués

- `node --check` sur les 16 fichiers JS, `manifest.json` validé.
- Test bout-en-bout dans un vrai DOM (jsdom + IndexedDB simulée), **57 assertions, toutes vertes** : rendu des 6 écrans, 22 exercices sur les 3 jours, notes et schémas d'origine, minuteur avec le bon temps de repos lu depuis le programme, séance enregistrée et relue dans l'historique, compteur semaine 1/12, onglet Progression, pesée, dépense ajoutée et remontée dans l'aperçu, prochains prélèvements (loyer le 5), création de tâches avec détection de retard, thème de couleur appliqué par onglet, habitude avec objectif hebdo, persistance réelle en IndexedDB.
- Test de robustesse du format (20 assertions) : aller-retour JSON sans perte y compris tâches/startDate/objectifs, idempotence de `normalize()`, absorption de documents corrompus, rejet des dates impossibles, montants négatifs et priorités inconnues, absence de fuite entre documents.

**Non testé ici** : le chemin File System Access réel (lier un fichier), qui demande un vrai Chrome — indisponible dans l'environnement de build. Le code suit le motif standard de l'API, mais c'est le premier point à vérifier sur ton Mac.

---

## À faire sur ton Mac

**1. Placer le projet.** Le dossier `Jarvis` n'a pas pu être créé directement chez toi (l'outil d'accès aux dossiers ne peut pas cibler un chemin inexistant, et le dossier utilisateur lui-même n'est pas montable). Copie le dossier `Jarvis` à l'emplacement voulu, par exemple `/Users/matisnelet/Jarvis`.

**2. Vérifier le fichier lié.** Ouvre l'app dans Chrome, Réglages → « Créer un nouveau fichier lié », et enregistre `jarvis-data.json` dans ton dossier iCloud Drive (par ex. `~/Library/Mobile Documents/com~apple~CloudDocs/Jarvis/`). Vérifie qu'une modification dans l'app se retrouve bien dans le fichier, puis qu'un rechargement de page la retrouve.

**3. Compléter le budget.** 18 des 28 postes sont à 0 € dans ton tableur (forfait mobile, mutuelle, assurance auto, frais KEDGE, épargne, marge de sécurité…). Ils sont repris tels quels — à renseigner dans l'onglet Prévisionnel.

**4. Envoyer ta maquette.** Le design actuel est délibérément neutre et minimal. Quand ta maquette est prête, l'essentiel devrait se jouer dans `css/tokens.css`.

Deux points ouverts en attente de ta réponse : reprendre ou non l'onglet *Cuisine* comme page, et l'absence de gestion multi-blocs côté sport (le programme est un Bloc 1 de 12 semaines — rien ne gère aujourd'hui le passage au Bloc 2).

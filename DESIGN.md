# DESIGN.md — carnet de bord

Référence pour modifier l'app sans tout redécouvrir. Public visé : Minh, ou une future session Claude.

## 1. Système de couleurs par onglet

Tout part d'UNE variable : `--c-brand`, posée sur `<body data-theme="…">` par le routeur (`js/router.js`, table `THEMES` route → thème). Surfaces, textes, bordures, halos sont **dérivés** de `--c-brand` par `color-mix` dans `css/tokens.css` — on ne définit jamais une couleur de carte ou de texte à la main.

| Onglet | `data-theme` | Variable | Valeur actuelle |
|---|---|---|---|
| Accueil | `home` | `--brand-home` | `#2f5fe0` bleu électrique |
| Sport | `sport` | `--brand-sport` | `#b5600c` ambre brûlé |
| Budget | `budget` | `--brand-budget` | `#33664d` vert sapin |
| Habitudes | `habits` | `--brand-habits` | `#7048d6` violet |
| Tâches | `tasks` | `--brand-tasks` | `#d14a33` corail terre |
| Réglages | `settings` | *(aucune)* | anthracite `#17171a` (défaut) |

**Changer une teinte** : modifier la valeur hex de `--brand-*` en tête de `tokens.css`. C'est tout — cartes, textes, liserés, anneaux, CTA suivent. Contraintes à respecter : blanc lisible dessus (≥ 4:1, la couleur sert de fond aux CTA/hero) et lisible sur crème `#f2f0ea` (~≥ 3.5:1). Script de vérif : voir la commande de calcul de contraste dans l'historique du projet, ou tester sur webaim.org/resources/contrastchecker.

**Rouge critique `#c62828`** (`--c-accent`) : réservé aux retards, dépassements, suppressions. Jamais décoratif. Le corail des Tâches est volontairement orangé pour ne pas s'y confondre. Le hero passe en rouge plein quand une tâche est en retard.

**Anneaux du tableau de bord** : exception voulue — chacun porte la couleur de SON module (ambre/sapin/violet), pas le bleu de l'accueil, via `opts.color` de `ring.js`.

## 2. Patterns de composants

- **Anneau de progression** — `js/components/ring.js`, styles `.ring*` dans `styles.css`. Usage : `ring(0.66, { value: "2", unit: "/3 séances", label: "Sport", color: "var(--brand-sport)", alert: false })`. Retourne du HTML (SVG). `alert: true` force le rouge critique. Sans `color`, prend l'accent de la page.
- **CTA pilule + cercle-flèche** — classe `btn primary cta` (+ `block` pour pleine largeur). Fond couleur de page, texte blanc à gauche, cercle blanc avec ↗ à droite (pseudo-élément `::after`, aucun markup à ajouter). Réservé à l'action principale d'un écran. Boutons secondaires : `btn` nu.
- **Cercle-flèche sur carte-lien** — `<span class="card-arrow">↗</span>` en premier enfant d'une `.card` cliquable (la carte est `position:relative`). Signale « il y a plus à voir ». Uniquement sur de vrais liens.
- **Carte** — `.card` (ou `.row` pour les lignes de liste, `.form-card`, `.exercise`) : fond blanc teinté à 7 % par la page, ombre douce (pas de bordure), **liseré 3 px couleur de page sur le bord gauche**. Ces quatre classes portent le même traitement ; toute nouvelle famille de carte doit le reprendre.
- **Bloc plein couleur** — `.hero` (accueil), `.due-day` (pastille jour de prélèvement), `.badge.pos` : fond `--c-brand` plein, texte `--c-brand-contrast` (blanc). C'est la signature « thème affirmé » ; ne pas en abuser ailleurs.
- **Sparkline** — fonction locale dans `js/modules/sport.js` (onglet Progression), stylée `.spark`. Histogramme 6 mois : `.mbars` dans `js/modules/finance.js`.
- **Minuteur de repos** — `js/components/timer.js`, global (survit aux changements d'onglet), déclenché par `startRest(secondes, label)` au clic sur une série. Wake lock + vibration, sans aucun son (usage en salle) ; recalcul du restant sur horloge (iOS gèle les intervals écran verrouillé).
- **Toast** — `window.dispatchEvent(new CustomEvent("jarvis:toast", { detail: { msg, isError } }))` depuis n'importe où.

## 3. Je veux modifier X → je touche à Y

| X | Y |
|---|---|
| Couleurs, typo, espacements, rayons, ombres | `css/tokens.css` (uniquement) |
| Apparence d'un composant | `css/styles.css` |
| Accueil / priorité du jour / anneaux | `js/modules/dashboard.js` |
| Sport (séance, progression, historique, poids) | `js/modules/sport.js` |
| Budget (aperçu, journal, prévisionnel, revenus) | `js/modules/finance.js` |
| Habitudes | `js/modules/habits.js` |
| Tâches | `js/modules/tasks.js` |
| Réglages / stockage (boutons) | `js/modules/settings.js` |
| Programme sport et postes budget par défaut | `js/seed.js` (référentiel, chargé au 1er lancement) |
| Forme des données, validation | `js/schema.js` (passer par `normalize`) |
| Backends de stockage (fichier lié / IndexedDB / export) | `js/storage.js` |
| Ajout d'une page | route dans `js/app.js` + thème dans `js/router.js` + lien nav dans `index.html` + fichier dans `SHELL` de `sw.js` |
| N'importe quel fichier statique modifié | **incrémenter `CACHE_NAME` dans `sw.js`** sinon les appareils installés gardent l'ancien |

## 4. Chronologie des décisions

1. **v1 sombre neutre** — base fonctionnelle volontairement non stylée, en attente d'une maquette utilisateur.
2. **6 thèmes plats par onglet** (indigo/corail/vert/prune/ambre/ardoise) — première tentative d'identité par page.
3. **Refonte monochrome sombre** — jugée « trop IA » ; passage à noir profond/anthracite, typo 860, nav flottante, anneaux, un seul rouge critique. Les 6 thèmes sont supprimés.
4. **Retour des accents par onglet** — le monochrome manquait de vie ; réintroduction d'une teinte par page, mais dérivée d'une seule variable au lieu de 6 blocs de styles.
5. **Patterns Rentra** — captures de référence : cercle-flèche sur cartes-liens, CTA pilule + cercle, correction des débordements 390 px.
6. **Immersion couleur** (fond de cartes et textes teintés) puis **bascule en clair crème** : l'utilisateur préfère la structure claire de Rentra, avec des thèmes FORTS (blocs pleins : hero, pastilles, badges) plutôt que des touches discrètes. Le vert émeraude devient sapin.
7. **Liseré 3 px + teinte 7 %** sur les cartes — pour reconnaître la page sur une carte isolée sans revenir aux blocs colorés.

Constantes non négociables à travers toutes les versions : zéro dépendance externe (pas de CDN, polices système), zéro réseau après chargement, données dans un seul JSON local, rouge réservé au critique, `tokens.css` comme unique source des valeurs de style.

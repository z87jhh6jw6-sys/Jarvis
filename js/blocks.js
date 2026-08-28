// Bibliothèque de blocs d'entraînement.
//
// Pourquoi des blocs : on ne progresse pas indéfiniment sur le même
// programme. Au bout de 10 à 12 semaines, le corps s'est adapté et les
// charges stagnent. Alterner un bloc orienté force (lourd, peu de
// répétitions) et un bloc orienté volume (plus léger, plus de séries)
// relance la progression — c'est le principe de la périodisation, la
// méthode la plus éprouvée pour progresser sur des années.
//
// Ces modèles sont des programmes classiques et solides, mais GÉNÉRIQUES :
// ton Bloc 1 avait été bâti pour toi. Tu peux et tu dois les ajuster dans
// l'onglet Programme. Et avec une scoliose, la technique passe avant la
// charge sur squat et soulevé de terre — si un bloc force te fait mal au
// dos, allège et parles-en à ton kiné.

const ex = (id, code, name, scheme, sets, rest, note, kind = "v") => ({
  id, code, name, scheme, note, kind, sets, restSeconds: rest, timed: false,
});

export const BLOCK_TEMPLATES = [
  {
    id: "force",
    name: "Force",
    subtitle: "12 semaines · charges lourdes, peu de répétitions",
    weeks: 12,
    why: "Après un bloc de masse, un bloc force consolide ce que tu as construit : tu apprends à utiliser le muscle gagné. Les charges montent, et au bloc volume suivant tu travailleras plus lourd à nombre de répétitions égal — c'est comme ça qu'on progresse d'année en année.",
    days: [
      {
        id: "f1", weekday: "Mardi", title: "Force — bas et poussée",
        intro: "Peu d'exercices, lourd, repos longs. La qualité de chaque série compte plus que le nombre. Si la technique se dégrade, tu arrêtes la série.",
        blocks: [
          { name: "Lourd — repos 3 min", exercises: [
            ex("f1a1","A","Squat barre","5 × 5",5,180,"Charge de départ : environ 85 % de ce que tu faisais en 4×5. Ajoute 2,5 kg par semaine tant que les 5 séries sortent propres.","f"),
            ex("f1a2","B","Développé couché barre","5 × 5",5,180,"Barre plutôt qu'haltères sur un bloc force : plus stable, on charge plus lourd. Demande une parade si tu montes vraiment.","f"),
            ex("f1a3","C","Rowing barre buste penché","4 × 6",4,150,"Le dos suit la même logique lourde. Buste à 45°, pas de mouvement de balancier.","f"),
          ]},
          { name: "Gainage — repos 60 s", exercises: [
            ex("f1b1","D","Gainage lesté","3 × 40 s",3,60,"Une plaque sur le haut du dos. Le tronc doit tenir les charges lourdes du bloc.","h"),
          ]},
        ],
      },
      {
        id: "f2", weekday: "Jeudi", title: "Force — tirage et épaules",
        intro: "Le jour le plus exigeant nerveusement. Mange bien avant, et ne t'entraîne pas à jeun.",
        blocks: [
          { name: "Lourd — repos 3 min 30", exercises: [
            ex("f2a1","A","Soulevé de terre barre","4 × 4",4,210,"Quatre répétitions seulement, mais lourdes. Dos plat impératif — avec une scoliose, si tu sens quoi que ce soit, tu allèges sans discuter.","f"),
            ex("f2a2","B","Développé militaire barre","4 × 5",4,150,"Debout, gainage serré. Si l'épaule tire, repasse aux haltères assis.","f"),
          ]},
          { name: "Tirage — repos 2 min 30", exercises: [
            ex("f2b1","C","Traction lestée","4 × 5",4,150,"Ceinture de lest dès que tu passes 8 tractions au poids de corps.","f"),
            ex("f2b2","D","Curl barre","3 × 8",3,90,"Le seul exercice de bras du jour.","v"),
          ]},
        ],
      },
      {
        id: "f3", weekday: "Vendredi", title: "Assistance",
        intro: "Séance plus légère, pour accumuler du volume sans fatiguer le système nerveux avant le week-end.",
        blocks: [
          { name: "Jambes — repos 2 min", exercises: [
            ex("f3a1","A","Presse à cuisses","4 × 8",4,120,"Complète le squat sans recharger la colonne."),
            ex("f3a2","B","Leg curl allongé","4 × 12",4,90,"Ischios : indispensable pour équilibrer un bloc chargé en squat et soulevé."),
          ]},
          { name: "Haut du corps — repos 90 s", exercises: [
            ex("f3b1","C","Dips lestés","4 × 6",4,120,"Descends jusqu'à l'angle droit, pas plus bas."),
            ex("f3b2","D","Tirage vertical prise large","4 × 8",4,90,"Largeur du dos."),
            ex("f3b3","E","Élévation latérale","3 × 15",3,60,"Léger, contrôlé."),
            ex("f3b4","F","Extension triceps poulie","3 × 12",3,60,"Finition."),
          ]},
        ],
      },
    ],
  },
  {
    id: "volume",
    name: "Volume",
    subtitle: "12 semaines · plus de séries, charges modérées",
    weeks: 12,
    why: "Bloc de construction musculaire : plus de répétitions, plus de séries, moins de repos. C'est ici que la masse se prend, en s'appuyant sur la force gagnée au bloc précédent.",
    days: [
      {
        id: "v1", weekday: "Mardi", title: "Poussée",
        intro: "Pectoraux, épaules, triceps. On cherche la tension et la congestion, pas le maximum.",
        blocks: [
          { name: "Pecs — repos 90 s", exercises: [
            ex("v1a1","A","Développé incliné haltères","4 × 10",4,90,"Banc à 30°. Temps d'arrêt en bas."),
            ex("v1a2","B","Développé couché haltères","4 × 12",4,90,"Amplitude complète."),
            ex("v1a3","C","Écarté à la poulie","3 × 15",3,75,"Tension constante, c'est l'intérêt de la poulie."),
          ]},
          { name: "Épaules et triceps — repos 75 s", exercises: [
            ex("v1b1","D","Développé épaules haltères","4 × 12",4,90,"Dossier à 80°, dos plaqué."),
            ex("v1b2","E","Élévation latérale poulie","4 × 15",4,60,"Bras dans le dos pour isoler le faisceau moyen."),
            ex("v1b3","F","Extension triceps corde","3 × 15",3,60,"Écarte la corde en fin de mouvement."),
          ]},
        ],
      },
      {
        id: "v2", weekday: "Jeudi", title: "Tirage",
        intro: "Dos et biceps. Ton dos est ce qui te tient droit — c'est la séance à ne jamais sauter.",
        blocks: [
          { name: "Dos — repos 90 s", exercises: [
            ex("v2a1","A","Tirage vertical prise large","4 × 12",4,90,"Largeur."),
            ex("v2a2","B","Rowing haltère unilatéral","4 × 12",4,90,"Un bras à la fois : utile quand un côté est plus faible, ce qui arrive souvent avec une scoliose. Commence toujours par le côté faible et aligne l'autre dessus."),
            ex("v2a3","C","Rowing à la poulie basse","3 × 15",3,75,"Épaisseur du dos."),
            ex("v2a4","D","Rear delt fly poulie","3 × 20",3,60,"Arrière d'épaule, essentiel pour la posture."),
          ]},
          { name: "Biceps — repos 60 s", exercises: [
            ex("v2b1","E","Curl incliné haltères","4 × 12",4,60,"Étirement maximal."),
            ex("v2b2","F","Curl marteau","3 × 15",3,60,"Avant-bras et brachial."),
          ]},
        ],
      },
      {
        id: "v3", weekday: "Vendredi", title: "Jambes et tronc",
        intro: "Grosse séance de jambes, puis abdos. Les jambes tirent la prise de poids générale.",
        blocks: [
          { name: "Jambes — repos 2 min", exercises: [
            ex("v3a1","A","Presse à cuisses","4 × 15",4,120,"Séries longues, pieds bas et serrés."),
            ex("v3a2","B","Leg curl allongé","4 × 12",4,90,"Ischios."),
            ex("v3a3","C","Leg extension","3 × 20",3,75,"Finition quadriceps."),
            ex("v3a4","D","Fentes marchées haltères","3 × 12 / jambe",3,90,"Équilibre et stabilité du bassin."),
            ex("v3a5","E","Mollets debout","4 × 20",4,60,"Amplitude complète, pause en haut."),
          ]},
          { name: "Abdos — repos 45 s", exercises: [
            ex("v3b1","F","Circuit abdos","3 tours",3,45,"Relevés de jambes 15, crunch à la poulie 15, planche 45 s.","h"),
          ]},
        ],
      },
    ],
  },
  {
    id: "entretien",
    name: "Entretien",
    subtitle: "Sans limite de durée · 3 séances par semaine",
    weeks: null,
    why: "Une fois l'objectif atteint, l'enjeu change : garder ce que tu as construit sans que la salle prenne toute ta vie. Trois séances complètes réparties sur la semaine, avec des charges qu'on maintient plutôt qu'on augmente. C'est un programme fait pour tenir des années, pas trois mois.",
    days: [
      {
        id: "e1", weekday: "Mardi", title: "Complet A — poussée et jambes",
        intro: "Les grands mouvements de poussée plus le squat. En entretien, l'objectif n'est pas d'ajouter du poids chaque semaine : ne pas reculer suffit.",
        blocks: [
          { name: "Séance — repos 2 min", exercises: [
            ex("e1a1","A","Squat barre","3 × 8",3,120,"Garde la charge stable d'une semaine sur l'autre.","f"),
            ex("e1a2","B","Développé couché haltères","3 × 8",3,120,"Amplitude complète.","f"),
            ex("e1a3","C","Développé épaules assis","3 × 10",3,90,"Dossier à 80°, dos plaqué."),
            ex("e1a4","D","Extension triceps corde","2 × 12",2,60,""),
            ex("e1a5","E","Gainage","3 × 45 s",3,60,"Le corset s'entretient aussi.","h"),
          ]},
        ],
      },
      {
        id: "e2", weekday: "Jeudi", title: "Complet B — tirage",
        intro: "La séance du dos. C'est elle qui entretient ton corset et ta posture : ne la saute jamais, même en semaine chargée.",
        blocks: [
          { name: "Séance — repos 2 min", exercises: [
            ex("e2a1","A","Soulevé de terre","3 × 5",3,150,"Charge raisonnable, technique irréprochable.","f"),
            ex("e2a2","B","Traction","3 × max",3,120,"Lestée si tu dépasses 10.","f"),
            ex("e2a3","C","Rowing barre","3 × 10",3,90,"Épaisseur du dos.","f"),
            ex("e2a4","D","Rear delt fly poulie","3 × 15",3,60,"Arrière d'épaule, garant de la posture."),
            ex("e2a5","E","Curl incliné","3 × 12",3,60,""),
            ex("e2a6","F","Planche latérale","3 × 30 s / côté",3,60,"Toujours prioritaire pour ta colonne.","h"),
          ]},
        ],
      },
      {
        id: "e3", weekday: "Vendredi", title: "Complet C — machines et volume léger",
        intro: "Séance plus douce sur les articulations, sur machines et poulies. Elle complète les deux autres et entretient le volume sans fatigue nerveuse.",
        blocks: [
          { name: "Séance — repos 90 s", exercises: [
            ex("e3a1","A","Presse à cuisses","3 × 12",3,120,"Complète le squat sans recharger la colonne."),
            ex("e3a2","B","Leg curl allongé","3 × 12",3,90,"Ischios."),
            ex("e3a3","C","Dips","3 × 10",3,90,"Lestés si c'est trop facile."),
            ex("e3a4","D","Tirage vertical prise large","3 × 12",3,90,"Largeur."),
            ex("e3a5","E","Élévation latérale","3 × 15",3,60,"Léger, contrôlé."),
            ex("e3a6","F","Bird-dog","3 × 10 / côté",3,60,"Gainage anti-rotation, dans la lignée de ta routine du matin.","h"),
          ]},
        ],
      },
    ],
  },
];

export function templateById(id) {
  return BLOCK_TEMPLATES.find((b) => b.id === id) || null;
}

// Quel bloc proposer ensuite.
// Règle : si le poids visé est atteint, on bascule en entretien. Sinon on
// alterne force et volume, en repartant sur volume après un bloc de masse.
export function suggestNext(program, profile, currentWeightKg) {
  const target = profile?.targetWeightKg;
  const reached = target && currentWeightKg && currentWeightKg >= target;
  if (reached) return templateById("entretien");

  const last = (program?.templateId || "").toLowerCase();
  if (last === "force") return templateById("volume");
  if (last === "entretien") return templateById("entretien");
  // Bloc 1 d'origine ou bloc volume terminé -> force
  return templateById("force");
}

// Construit un programme complet à partir d'un modèle, en gardant la
// routine quotidienne (d0) que l'utilisateur a pu personnaliser.
export function buildProgram(template, currentProgram, blockNumber) {
  const routine = (currentProgram?.days || []).find((d) => d.id === "d0");
  const days = JSON.parse(JSON.stringify(template.days));
  return {
    id: `${template.id}-${blockNumber}`,
    templateId: template.id,
    blockNumber,
    name: `Bloc ${blockNumber} — ${template.name}`,
    weeks: template.weeks,
    sessionsPerWeek: template.days.length,
    bodyweight: currentProgram?.bodyweight || { start: 60, target: 64, unit: "kg" },
    startDate: null,
    days: routine ? [routine, ...days] : days,
  };
}

// Calcul des besoins journaliers à partir du profil.
//
// Méthode : Mifflin-St Jeor pour le métabolisme de base, multiplié par un
// facteur d'activité, puis ajusté selon l'objectif. C'est l'estimation la
// plus couramment retenue en l'absence de mesure clinique.
//
// À garder en tête : c'est une ESTIMATION statistique, pas une mesure. Deux
// personnes de mêmes taille, poids et âge peuvent avoir 200 kcal d'écart
// réel. La bonne façon de s'en servir : suivre son poids deux à trois
// semaines, puis ajuster de ±200 kcal si la balance ne va pas dans le sens
// voulu. C'est le poids qui tranche, pas la formule.

export const ACTIVITY_LEVELS = [
  { id: "sedentaire", label: "Sédentaire — bureau, peu de marche", factor: 1.2 },
  { id: "leger", label: "Léger — 1 à 2 séances par semaine", factor: 1.375 },
  { id: "modere", label: "Modéré — 3 à 4 séances par semaine", factor: 1.55 },
  { id: "actif", label: "Actif — 5 à 6 séances par semaine", factor: 1.725 },
  { id: "tres-actif", label: "Très actif — sport quotidien ou métier physique", factor: 1.9 },
];

export const GOALS = [
  { id: "masse", label: "Prendre de la masse", kcal: 1.15, protein: 1.8 },
  { id: "force", label: "Gagner en force", kcal: 1.1, protein: 2.0 },
  { id: "tonifier", label: "Me tonifier", kcal: 1.0, protein: 2.0 },
  { id: "seche", label: "Perdre du gras", kcal: 0.8, protein: 2.2 },
  { id: "maintien", label: "Maintenir mon poids", kcal: 1.0, protein: 1.6 },
  { id: "cardio", label: "Gagner en cardio", kcal: 1.05, protein: 1.6 },
];

export function activityFactor(id) {
  return (ACTIVITY_LEVELS.find((a) => a.id === id) || ACTIVITY_LEVELS[2]).factor;
}

export function goalOf(id) {
  return GOALS.find((g) => g.id === id) || GOALS[0];
}

// Métabolisme de base en kcal/jour (Mifflin-St Jeor).
export function basalRate(profile) {
  const { sex, weightKg, heightCm, age } = profile || {};
  if (!weightKg || !heightCm || !age) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === "femme" ? base - 161 : base + 5);
}

// Dépense totale estimée en kcal/jour, avant application de l'objectif.
export function maintenance(profile) {
  const bmr = basalRate(profile);
  if (bmr === null) return null;
  return Math.round(bmr * activityFactor(profile.activity));
}

// Objectifs journaliers déduits du profil.
export function computeTargets(profile) {
  const tdee = maintenance(profile);
  if (tdee === null) return null;
  const goal = goalOf(profile.goal);
  return {
    kcal: Math.round((tdee * goal.kcal) / 10) * 10,
    protein: Math.round(profile.weightKg * goal.protein),
    // 35 ml par kg, arrondi au quart de litre pour coller aux boutons +25 cl.
    waterMl: Math.round((profile.weightKg * 35) / 250) * 250,
  };
}

// Objectifs réellement appliqués : ceux calculés, sauf si l'utilisateur a
// saisi les siens à la main.
export function effectiveTargets(profile) {
  if (!profile) return { kcal: 0, protein: 0, waterMl: 0 };
  if (profile.auto === false) {
    return {
      kcal: profile.targets?.kcal || 0,
      protein: profile.targets?.protein || 0,
      waterMl: profile.targets?.waterMl || 0,
    };
  }
  return computeTargets(profile) || { kcal: 0, protein: 0, waterMl: 0 };
}

export function isProfileComplete(profile) {
  return Boolean(profile?.weightKg && profile?.heightCm && profile?.age);
}

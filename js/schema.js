// Forme du document jarvis-data.json — source de vérité unique.
// Frontière entre "ce qu'il y a sur le disque" et le reste de l'app :
// tout ce qui entre passe par normalize().

import { SEED } from "./seed.js";
import { isValidDateISO, parseNumber, clampString } from "./utils.js";

export const SCHEMA_VERSION = 1;

export function emptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),

    sport: {
      program: structuredCloneSafe(SEED.program),
      // Une entrée par séance réalisée.
      sessions: [],
      // Dernière charge connue par exercice : { [exerciseId]: "60" }
      lastLoads: {},
      // Relevés de poids de corps : [{ date, kg }]
      weighIns: [],
    },

    finance: {
      categories: structuredCloneSafe(SEED.finance.categories),
      postes: structuredCloneSafe(SEED.finance.postes),
      revenues: structuredCloneSafe(SEED.finance.revenues),
      // Journal des dépenses réelles.
      transactions: [],
    },

    habits: {
      habits: [],
      checkins: [],
    },

    tasks: [],
  };
}

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

// Ne jette jamais : renvoie toujours un document exploitable.
// Les entrées invalides sont écartées plutôt que de casser l'app.
export function normalize(raw) {
  if (!raw || typeof raw !== "object") return emptyData();
  const base = emptyData();

  const program = obj(raw?.sport?.program);
  const hasProgram = Array.isArray(program.days) && program.days.length > 0;

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,

    sport: {
      program: cleanProgram(hasProgram ? program : base.sport.program, raw?.sport?.program),
      sessions: arr(raw?.sport?.sessions).filter(isValidSession).map(cleanSession),
      lastLoads: cleanLastLoads(raw?.sport?.lastLoads),
      weighIns: arr(raw?.sport?.weighIns)
        .filter((w) => isValidDateISO(w?.date) && parseNumber(w?.kg) !== null)
        .map((w) => ({ date: w.date, kg: parseNumber(w.kg) })),
    },

    finance: {
      categories: arr(raw?.finance?.categories).length
        ? arr(raw.finance.categories)
        : base.finance.categories,
      postes: arr(raw?.finance?.postes).length ? arr(raw.finance.postes) : base.finance.postes,
      revenues: arr(raw?.finance?.revenues).length
        ? arr(raw.finance.revenues)
        : base.finance.revenues,
      transactions: arr(raw?.finance?.transactions).filter(isValidTx).map(cleanTx),
    },

    habits: {
      habits: arr(raw?.habits?.habits)
        .filter((h) => h && typeof h.id === "string" && typeof h.name === "string")
        .map((h) => {
          const target = parseNumber(h.targetPerWeek);
          return {
            id: h.id,
            name: clampString(h.name, 80),
            createdAt: typeof h.createdAt === "string" ? h.createdAt : new Date().toISOString(),
            archived: Boolean(h.archived),
            // Objectif hebdomadaire optionnel (1 à 7 jours par semaine).
            targetPerWeek:
              target !== null && target >= 1 && target <= 7 ? Math.round(target) : null,
          };
        }),
      checkins: arr(raw?.habits?.checkins)
        .filter((c) => c && typeof c.habitId === "string" && isValidDateISO(c.date))
        .map((c) => ({
          id: typeof c.id === "string" ? c.id : c.habitId + ":" + c.date,
          habitId: c.habitId,
          date: c.date,
          done: Boolean(c.done),
        })),
    },

    tasks: arr(raw?.tasks)
      .filter((t) => t && typeof t.id === "string" && typeof t.title === "string")
      .map((t) => ({
        id: t.id,
        title: clampString(t.title, 140),
        due: isValidDateISO(t.due) ? t.due : null,
        priority: ["haute", "normale", "basse"].includes(t.priority) ? t.priority : "normale",
        done: Boolean(t.done),
        doneAt: typeof t.doneAt === "string" ? t.doneAt : null,
        createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
        note: clampString(t.note, 300),
      })),
  };
}

// Préserve startDate (posée à la première séance) et borne bodyweight.
function cleanProgram(program, rawProgram) {
  const p = JSON.parse(JSON.stringify(program));
  const rawStart = rawProgram?.startDate;
  p.startDate = isValidDateISO(rawStart) ? rawStart : (isValidDateISO(p.startDate) ? p.startDate : null);
  return p;
}

function isValidSession(s) {
  return s && typeof s.id === "string" && isValidDateISO(s.date) && Array.isArray(s.entries);
}

function cleanSession(s) {
  return {
    id: s.id,
    date: s.date,
    dayId: clampString(s.dayId, 40),
    dayTitle: clampString(s.dayTitle, 80),
    notes: clampString(s.notes, 500),
    entries: arr(s.entries)
      .filter((e) => e && typeof e.exerciseId === "string")
      .map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: clampString(e.exerciseName, 120),
        load: parseNumber(e.load),
        setsDone: Number.isFinite(Number(e.setsDone)) ? Number(e.setsDone) : 0,
        setsPlanned: Number.isFinite(Number(e.setsPlanned)) ? Number(e.setsPlanned) : 0,
      })),
  };
}

function cleanLastLoads(raw) {
  const src = obj(raw);
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    const n = parseNumber(v);
    if (typeof k === "string" && n !== null) out[k] = n;
  }
  return out;
}

function isValidTx(t) {
  return (
    t &&
    typeof t.id === "string" &&
    isValidDateISO(t.date) &&
    parseNumber(t.amount) !== null &&
    parseNumber(t.amount) > 0
  );
}

function cleanTx(t) {
  return {
    id: t.id,
    date: t.date,
    categoryId: clampString(t.categoryId, 40),
    posteId: clampString(t.posteId, 40),
    label: clampString(t.label, 120),
    amount: parseNumber(t.amount),
    payment: clampString(t.payment, 30),
    note: clampString(t.note, 200),
  };
}

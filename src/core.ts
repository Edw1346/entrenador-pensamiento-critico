import { exercises, skills } from "./bank";
import type { Exercise, SkillId } from "./types";
export type Mode = "practice" | "diagnostic" | "exam" | "review" | "transfer";
export type Answer = string | string[];
export interface Assessment {
  scores: number[];
  reasons: string[];
}
export interface Attempt {
  id: string;
  exerciseId: string;
  at: string;
  answer: Answer;
  score: number;
  isNew: boolean;
  mode: Mode;
  sessionId: string;
  method: "automatic" | "self";
  assessment?: Assessment;
  correctionOf?: string;
  appeal?: { text: string; at: string };
}
export interface Session {
  id: string;
  mode: Mode;
  exerciseIds: string[];
  startedAt: string;
  completedAt?: string;
}
export interface State {
  version: 1;
  attempts: Attempt[];
  sessions: Session[];
}
export const STORAGE_KEY = "criterio-v1";
export const emptyState = (): State => ({
  version: 1,
  attempts: [],
  sessions: [],
});
export const uid = () => crypto.randomUUID();
export function completeAnswer(e: Exercise, a: Answer): boolean {
  if (e.kind === "open")
    return typeof a === "string" && a.trim().length >= 30 && a.length <= 10000;
  if (e.kind === "choice")
    return typeof a === "string" && !!e.options?.some((o) => o.id === a);
  return (
    Array.isArray(a) &&
    a.length === e.steps?.length &&
    a.every((v, i) => e.steps![i].options.some((o) => o.id === v))
  );
}
export function evaluate(
  e: Exercise,
  a: Answer,
  assessment?: Assessment,
): number {
  if (!completeAnswer(e, a))
    throw new Error("Completa la respuesta antes de evaluarla.");
  if (e.kind === "open") {
    if (
      !assessment ||
      assessment.scores.length !== e.rubric.length ||
      assessment.reasons.length !== e.rubric.length ||
      !assessment.scores.every((s) => [0, 1, 2].includes(s)) ||
      !assessment.reasons.every(
        (r) => r.trim().length >= 10 && r.length <= 2000,
      )
    )
      throw new Error(
        "Puntúa y justifica cada criterio (al menos 10 caracteres).",
      );
    return Math.round(
      (100 * assessment.scores.reduce((s, v) => s + v, 0)) /
        (2 * e.rubric.length),
    );
  }
  if (e.kind === "choice") return a === e.answer ? 100 : 0;
  return Math.round(
    (100 * e.steps!.filter((s, i) => s.answer === a[i]).length) /
      e.steps!.length,
  );
}
export function newAttempt(
  state: State,
  e: Exercise,
  a: Answer,
  session: Session,
  assessment?: Assessment,
  correctionOf?: string,
): Attempt {
  return {
    id: uid(),
    exerciseId: e.id,
    at: new Date().toISOString(),
    answer: structuredClone(a),
    score: evaluate(e, a, assessment),
    isNew: !state.attempts.some((x) => x.exerciseId === e.id),
    mode: session.mode,
    sessionId: session.id,
    method: e.kind === "open" ? "self" : "automatic",
    ...(assessment ? { assessment } : {}),
    ...(correctionOf ? { correctionOf } : {}),
  };
}
export function selectExercises(
  mode: Mode,
  state: State,
  skill?: SkillId,
): Exercise[] {
  const seen = new Set(state.attempts.map((a) => a.exerciseId));
  const pool = exercises.filter((e) => !skill || e.skill === skill);
  if (mode === "diagnostic")
    return skills.map(
      (s) => exercises.find((e) => e.skill === s.id && e.id.endsWith("-1"))!,
    );
  if (mode === "exam")
    return skills.flatMap((s) => {
      const e = pool.find(
        (e) => e.skill === s.id && e.kind !== "open" && !seen.has(e.id),
      );
      return e ? [e] : [];
    });
  if (mode === "review") {
    const last = new Map<string, Attempt>();
    visibleAttempts(state).forEach((a) => last.set(a.exerciseId, a));
    return pool.filter((e) => {
      const a = last.get(e.id);
      return a && a.score < 70;
    });
  }
  if (mode === "transfer")
    return pool.filter((e) => !seen.has(e.id) && e.difficulty > 1).slice(0, 6);
  const last = state.attempts.at(-1)?.exerciseId;
  return [
    ...pool.filter((e) => !seen.has(e.id)),
    ...pool.filter((e) => seen.has(e.id) && e.id !== last),
  ].slice(0, 6);
}
export function visibleAttempts(state: State) {
  return state.attempts.filter(
    (a) =>
      !(
        ["exam", "diagnostic"].includes(a.mode) &&
        !state.sessions.find((s) => s.id === a.sessionId)?.completedAt
      ),
  );
}
export function stats(state: State, skill?: SkillId) {
  const ids = new Set(
    exercises.filter((e) => !skill || e.skill === skill).map((e) => e.id),
  );
  const attempts = visibleAttempts(state).filter((a) => ids.has(a.exerciseId));
  const mean = (a: Attempt[]) =>
    a.length ? Math.round(a.reduce((s, v) => s + v.score, 0) / a.length) : null;
  return {
    count: attempts.length,
    newScore: mean(attempts.filter((a) => a.isNew && a.method === "automatic")),
    knownScore: mean(
      attempts.filter((a) => !a.isNew && a.method === "automatic"),
    ),
    selfScore: mean(attempts.filter((a) => a.method === "self")),
    diagnostic: mean(
      attempts.filter((a) => a.mode === "diagnostic" && !a.correctionOf),
    ),
    unique: new Set(attempts.map((a) => a.exerciseId)).size,
  };
}
export function errorPatterns(state: State) {
  return skills
    .map((s) => ({
      ...s,
      count: visibleAttempts(state).filter(
        (a) =>
          a.score < 70 &&
          !a.correctionOf &&
          exercises.find((e) => e.id === a.exerciseId)?.skill === s.id,
      ).length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
}
const obj = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const date = (v: unknown) =>
  typeof v === "string" && v.length < 40 && Number.isFinite(Date.parse(v));
const str = (v: unknown, max = 100) =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const modes = ["practice", "diagnostic", "exam", "review", "transfer"];
export function parseBackup(text: string): State {
  if (text.length > 5_000_000)
    throw new Error("El archivo excede el límite de 5 MB.");
  let d: any;
  try {
    d = JSON.parse(text);
  } catch {
    throw new Error("El archivo no contiene JSON válido.");
  }
  if (
    !obj(d) ||
    d.version !== 1 ||
    !Array.isArray(d.attempts) ||
    !Array.isArray(d.sessions) ||
    d.attempts.length > 20000 ||
    d.sessions.length > 20000
  )
    throw new Error("Formato de copia incompatible.");
  const fail = () => {
    throw new Error("La copia contiene datos inválidos o inconsistentes.");
  };
  const sessionIds = new Set<string>();
  for (const s of d.sessions) {
    if (
      !obj(s) ||
      !str(s.id) ||
      sessionIds.has(s.id) ||
      !modes.includes(s.mode) ||
      !Array.isArray(s.exerciseIds) ||
      s.exerciseIds.length === 0 ||
      s.exerciseIds.length > 48 ||
      new Set(s.exerciseIds).size !== s.exerciseIds.length ||
      !s.exerciseIds.every((id: unknown) =>
        exercises.some((e) => e.id === id),
      ) ||
      !date(s.startedAt) ||
      (s.completedAt !== undefined && !date(s.completedAt))
    )
      fail();
    sessionIds.add(s.id);
  }
  const attemptIds = new Set<string>();
  for (const a of d.attempts) {
    if (!obj(a)) fail();
    const e = exercises.find((e) => e.id === a.exerciseId);
    const s = d.sessions.find((s: Session) => s.id === a.sessionId);
    if (
      !e ||
      !s ||
      !str(a.id) ||
      attemptIds.has(a.id) ||
      !date(a.at) ||
      !s.exerciseIds.includes(a.exerciseId) ||
      a.mode !== s.mode ||
      typeof a.isNew !== "boolean" ||
      a.method !== (e.kind === "open" ? "self" : "automatic") ||
      !completeAnswer(e, a.answer)
    )
      fail();
    try {
      if (evaluate(e!, a.answer, a.assessment) !== a.score) fail();
    } catch {
      fail();
    }
    if (
      a.isNew !==
      !d.attempts
        .slice(0, attemptIds.size)
        .some((p: Attempt) => p.exerciseId === a.exerciseId)
    )
      fail();
    if (
      a.correctionOf !== undefined &&
      !d.attempts
        .slice(0, attemptIds.size)
        .some(
          (p: Attempt) =>
            p.id === a.correctionOf && p.exerciseId === a.exerciseId,
        )
    )
      fail();
    if (
      a.appeal !== undefined &&
      (!obj(a.appeal) || !str(a.appeal.text, 3000) || !date(a.appeal.at))
    )
      fail();
    attemptIds.add(a.id);
  }
  return { version: 1, attempts: d.attempts, sessions: d.sessions };
}
export function loadState(storage: Pick<Storage, "getItem">): {
  state: State;
  error?: string;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return { state: raw ? parseBackup(raw) : emptyState() };
  } catch {
    return {
      state: emptyState(),
      error:
        "No se pudieron recuperar los datos. Exporta el almacenamiento original antes de reemplazarlo.",
    };
  }
}
export function saveState(storage: Pick<Storage, "setItem">, state: State) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return null;
  } catch {
    return "No se pudo guardar en este navegador. Descarga una copia antes de cerrar.";
  }
}
export function toCsv(state: State) {
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[\s\x00-\x1f]*[=+@\-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return (
    "\uFEFF" +
    [
      [
        "fecha",
        "ejercicio",
        "habilidad",
        "modo",
        "puntuacion",
        "nuevo",
        "metodo",
        "respuesta",
        "objecion",
      ],
      ...state.attempts.map((a) => [
        a.at,
        a.exerciseId,
        exercises.find((e) => e.id === a.exerciseId)?.skill,
        a.mode,
        a.score,
        a.isNew,
        a.method,
        JSON.stringify(a.answer),
        a.appeal?.text,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}

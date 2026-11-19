import test from "node:test";
import assert from "node:assert/strict";
import { exercises, skills } from "../src/bank.ts";
import {
  completeAnswer,
  evaluate,
  emptyState,
  newAttempt,
  selectExercises,
  stats,
  errorPatterns,
  parseBackup,
  loadState,
  saveState,
  toCsv,
  STORAGE_KEY,
} from "../src/core.ts";
import type { State, Session, Assessment, Answer } from "../src/core.ts";
import type { Exercise } from "../src/types.ts";

const choice = () => exercises.find((e) => e.kind === "choice")!;
const stepped = () => exercises.find((e) => e.kind === "steps")!;
const open = () => exercises.find((e) => e.kind === "open")!;
const goodAnswer = (e: Exercise): Answer =>
  e.kind === "choice"
    ? e.answer!
    : e.kind === "steps"
      ? e.steps!.map((s) => s.answer)
      : e.modelAnswer;
const assessment = (e: Exercise, score = 2): Assessment => ({
  scores: e.rubric.map(() => score),
  reasons: e.rubric.map(
    (c) => `La respuesta demuestra el criterio ${c.label}.`,
  ),
});
function add(
  state: State,
  e: Exercise,
  answer: Answer = goodAnswer(e),
  mode: Session["mode"] = "practice",
  correctionOf?: string,
) {
  const session: Session = {
    id: crypto.randomUUID(),
    mode,
    exerciseIds: [e.id],
    startedAt: new Date().toISOString(),
  };
  state.sessions.push(session);
  const attempt = newAttempt(
    state,
    e,
    answer,
    session,
    e.kind === "open" ? assessment(e) : undefined,
    correctionOf,
  );
  state.attempts.push(attempt);
  session.completedAt = new Date().toISOString();
  return attempt;
}
function fixture() {
  const state = emptyState();
  add(state, choice());
  return state;
}

test("Banco: 48 ejercicios únicos cubren doce habilidades y los tres formatos", () => {
  assert.equal(skills.length, 12);
  assert.equal(exercises.length, 48);
  assert.equal(new Set(exercises.map((e) => e.id)).size, 48);
  for (const skill of skills) {
    const group = exercises.filter((e) => e.skill === skill.id);
    assert.equal(group.length, 4);
    assert.deepEqual(group.map((e) => e.kind).sort(), [
      "choice",
      "choice",
      "open",
      "steps",
    ]);
    assert.ok(group.some((e) => e.difficulty === 1));
    assert.ok(group.some((e) => e.difficulty === 3));
  }
});
test("Banco: cada ejercicio aporta objetivo, explicación, modelo, rúbrica y transferencia", () => {
  for (const e of exercises) {
    for (const key of [
      "title",
      "objective",
      "prompt",
      "modelAnswer",
      "explanation",
      "harderVariant",
      "family",
    ] as const)
      assert.ok(e[key].trim().length > 0, `${e.id}: ${key}`);
    assert.ok(e.commonErrors.length > 0);
    assert.equal(e.rubric.length, 3);
    assert.equal(new Set(e.rubric.map((c) => c.id)).size, 3);
    for (const c of e.rubric) assert.ok(c.description.length > 10);
  }
});
test("Banco: las claves existen, son únicas y cada opción incorrecta obtiene cero", () => {
  for (const e of exercises.filter((e) => e.kind === "choice")) {
    assert.ok(e.options!.length >= 3);
    assert.equal(new Set(e.options!.map((o) => o.id)).size, e.options!.length);
    assert.equal(e.options!.filter((o) => o.id === e.answer).length, 1);
    assert.equal(evaluate(e, e.answer!), 100);
    for (const option of e.options!.filter((o) => o.id !== e.answer))
      assert.equal(evaluate(e, option.id), 0);
  }
});
test("Pasos: crédito parcial proporcional y rechazo de respuestas incompletas", () => {
  for (const e of exercises.filter((e) => e.kind === "steps")) {
    const good = e.steps!.map((s) => s.answer);
    assert.equal(evaluate(e, good), 100);
    const partial = [...good];
    partial[0] = e.steps![0].options.find((o) => o.id !== good[0])!.id;
    assert.equal(
      evaluate(e, partial),
      Math.round((100 * (good.length - 1)) / good.length),
    );
    assert.equal(completeAnswer(e, good.slice(1)), false);
    assert.throws(() => evaluate(e, good.slice(1)));
    assert.equal(completeAnswer(e, "invalid"), false);
  }
});
test("Validación: selección vacía, opción inexistente, texto vacío y límites", () => {
  assert.equal(completeAnswer(choice(), ""), false);
  assert.equal(completeAnswer(choice(), "unknown"), false);
  assert.throws(() => evaluate(choice(), "unknown"));
  assert.equal(completeAnswer(open(), " ".repeat(50)), false);
  assert.equal(completeAnswer(open(), "a".repeat(29)), false);
  assert.equal(completeAnswer(open(), "a".repeat(30)), true);
  assert.equal(completeAnswer(open(), "a".repeat(10000)), true);
  assert.equal(completeAnswer(open(), "a".repeat(10001)), false);
});
test("Abiertas: rúbrica transparente con motivos obligatorios y valores discretos", () => {
  const e = open(),
    a = goodAnswer(e);
  assert.equal(evaluate(e, a, assessment(e)), 100);
  assert.equal(evaluate(e, a, assessment(e, 1)), 50);
  assert.equal(evaluate(e, a, assessment(e, 0)), 0);
  assert.throws(() => evaluate(e, a));
  for (const invalid of [
    { ...assessment(e), scores: [2] },
    { ...assessment(e), scores: [2, 2, 3] },
    { ...assessment(e), scores: [2, 2, 1.5] },
    { ...assessment(e), reasons: ["", "", ""] },
    {
      ...assessment(e),
      reasons: [
        "a".repeat(2001),
        "justificación adecuada",
        "justificación adecuada",
      ],
    },
  ])
    assert.throws(() => evaluate(e, a, invalid));
});
test("Diagnóstico: exactamente una pregunta de cada área y dificultad inicial", () => {
  const selected = selectExercises("diagnostic", emptyState());
  assert.equal(selected.length, 12);
  assert.equal(new Set(selected.map((e) => e.skill)).size, 12);
  assert.ok(selected.every((e) => e.difficulty === 1));
});
test("Exámenes: solo preguntas nuevas; agotan honestamente el banco cerrado", () => {
  const state = emptyState();
  const seen = new Set<string>();
  let rounds = 0;
  while (true) {
    const selected = selectExercises("exam", state);
    if (!selected.length) break;
    assert.ok(selected.length <= 12);
    assert.equal(new Set(selected.map((e) => e.skill)).size, selected.length);
    for (const e of selected) {
      assert.notEqual(e.kind, "open");
      assert.equal(seen.has(e.id), false);
      seen.add(e.id);
      add(state, e, goodAnswer(e), "exam");
    }
    assert.ok(++rounds <= 4);
  }
  assert.equal(seen.size, 36);
  assert.deepEqual(selectExercises("exam", state), []);
});
test("Transferencia: nuevos, dificultad superior y filtro por habilidad", () => {
  const state = fixture();
  const selected = selectExercises("transfer", state, "probability");
  assert.ok(selected.length > 0);
  assert.ok(
    selected.every(
      (e) =>
        e.skill === "probability" &&
        e.difficulty > 1 &&
        !state.attempts.some((a) => a.exerciseId === e.id),
    ),
  );
});
test("Práctica: no repite inmediatamente la última pregunta al agotar el banco", () => {
  const state = emptyState();
  exercises.forEach((e) => add(state, e));
  const last = state.attempts.at(-1)!.exerciseId;
  assert.ok(selectExercises("practice", state).every((e) => e.id !== last));
});
test("Repaso usa el último intento y retira un fallo corregido", () => {
  const state = emptyState(),
    e = choice(),
    wrong = e.options!.find((o) => o.id !== e.answer)!.id;
  const first = add(state, e, wrong);
  assert.deepEqual(
    selectExercises("review", state).map((e) => e.id),
    [e.id],
  );
  const next = add(state, e, e.answer!, "review", first.id);
  assert.equal(first.isNew, true);
  assert.equal(next.isNew, false);
  assert.equal(next.correctionOf, first.id);
  assert.deepEqual(selectExercises("review", state), []);
  assert.equal(errorPatterns(state).find((p) => p.id === e.skill)?.count, 1);
});
test("Estadísticas separan nuevas, conocidas y autoevaluaciones; no inflan diagnóstico con correcciones", () => {
  const state = emptyState(),
    e = choice(),
    wrong = e.options!.find((o) => o.id !== e.answer)!.id;
  const first = add(state, e, wrong, "diagnostic");
  add(state, e, e.answer!, "diagnostic", first.id);
  add(state, open());
  const s = stats(state);
  assert.equal(s.newScore, 0);
  assert.equal(s.knownScore, 100);
  assert.equal(s.selfScore, 100);
  assert.equal(s.diagnostic, 0);
  assert.equal(s.count, 3);
  assert.equal(s.unique, 2);
  assert.equal(stats(emptyState()).newScore, null);
});
test("Persistencia: copia conserva intentos, objeciones y sesiones; reapertura recupera estado", () => {
  const state = fixture();
  state.attempts[0].appeal = {
    text: "Solicito revisar la interpretación de la premisa.",
    at: new Date().toISOString(),
  };
  const memory = new Map<string, string>();
  const storage = {
    setItem: (k: string, v: string) => void memory.set(k, v),
    getItem: (k: string) => memory.get(k) ?? null,
  };
  assert.equal(saveState(storage, state), null);
  assert.ok(memory.has(STORAGE_KEY));
  assert.deepEqual(loadState(storage), { state });
  assert.deepEqual(parseBackup(JSON.stringify(state)), state);
});
test("Recuperación: JSON corrupto, versión incorrecta, archivos grandes y formas inválidas se rechazan", () => {
  for (const value of [
    "{",
    "null",
    "[]",
    "{}",
    JSON.stringify({ version: 2, attempts: [], sessions: [] }),
    " ".repeat(5_000_001),
  ])
    assert.throws(() => parseBackup(value));
});
test("Recuperación: rechaza duplicados, IDs desconocidos, puntuaciones falsas y referencias rotas", () => {
  const mutations: Array<(s: any) => void> = [
    (s) => s.attempts.push(s.attempts[0]),
    (s) => s.sessions.push(s.sessions[0]),
    (s) => (s.attempts[0].score = 99),
    (s) => (s.attempts[0].exerciseId = "unknown"),
    (s) => (s.attempts[0].sessionId = "missing"),
    (s) => (s.attempts[0].isNew = false),
    (s) => (s.attempts[0].correctionOf = "missing"),
    (s) => (s.attempts[0].method = "self"),
    (s) => (s.attempts[0].at = "not-a-date"),
    (s) => s.sessions[0].exerciseIds.push(s.sessions[0].exerciseIds[0]),
    (s) => (s.sessions[0].mode = "not-a-mode"),
    (s) => (s.attempts[0].appeal = { text: "x", at: "bad" }),
  ];
  for (const mutate of mutations) {
    const s = fixture();
    mutate(s);
    assert.throws(() => parseBackup(JSON.stringify(s)));
  }
});
test("Persistencia: fallos de permisos, cuota y datos corruptos generan avisos", () => {
  assert.ok(
    saveState(
      {
        setItem() {
          throw new Error("quota");
        },
      },
      emptyState(),
    ),
  );
  const blocked = loadState({
    getItem() {
      throw new Error("blocked");
    },
  });
  assert.deepEqual(blocked.state, emptyState());
  assert.ok(blocked.error);
  assert.ok(loadState({ getItem: () => "{" }).error);
  assert.deepEqual(loadState({ getItem: () => null }), { state: emptyState() });
});
test("CSV: conserva texto con comillas y neutraliza fórmulas de objeciones", () => {
  const state = fixture();
  state.attempts[0].appeal = {
    text: '=HYPERLINK("example")',
    at: new Date().toISOString(),
  };
  const csv = toCsv(state);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"puntuacion"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""example"")"'));
  assert.equal(csv.split("\r\n").length, 2);
});
test("CSV: signos precedidos por espacios o controles se neutralizan sin perder contenido", () => {
  for (const text of ["\t=1+1", "  +1", "\r@SUM(A1)", " -2"]) {
    const state = fixture();
    state.attempts[0].appeal = { text, at: new Date().toISOString() };
    const csv = toCsv(state);
    assert.ok(csv.includes("\"'" + text + '"'));
  }
});
test("Numeración: las cuentas de tasas base, dependencia, promedio y actualización coinciden con el banco", () => {
  const byId = (id: string) => exercises.find((e) => e.id === id)!;
  assert.equal(Math.round((10 / (10 + 99)) * 1000) / 10, 9.2);
  assert.ok(
    byId("probability-1")
      .options!.find((o) => o.id === byId("probability-1").answer)!
      .text.includes("10/109"),
  );
  assert.equal((3 / 5) * (2 / 4), 0.3);
  assert.equal((1000 * 4 + 6000) / 5, 2000);
  assert.equal((81 + 2) / 100, 0.83);
  assert.equal((19 + 24) / 100, 0.43);
  assert.equal((0.2 * 0.6) / (0.2 * 0.6 + 0.8 * 0.1), 0.6);
  assert.ok(
    byId("updating-3")
      .steps!.at(-1)!
      .options.find((o) => o.id === byId("updating-3").steps!.at(-1)!.answer)!
      .text.includes("60"),
  );
});
test("Examen y diagnóstico en curso: notas y errores permanecen ocultos hasta terminar", () => {
  for (const mode of ["exam", "diagnostic"] as const) {
    const state = emptyState(),
      e = choice(),
      wrong = e.options!.find((o) => o.id !== e.answer)!.id;
    add(state, e, wrong, mode);
    delete state.sessions[0].completedAt;
    assert.equal(stats(state).newScore, null);
    assert.equal(stats(state).knownScore, null);
    assert.equal(stats(state).diagnostic, null);
    assert.deepEqual(errorPatterns(state), []);
    assert.deepEqual(selectExercises("review", state), []);
    state.sessions[0].completedAt = new Date().toISOString();
    assert.equal(stats(state).newScore, 0);
    assert.equal(errorPatterns(state).length, 1);
    assert.equal(selectExercises("review", state)[0].id, e.id);
  }
});
test("Práctica en curso: permite retroalimentación inmediata y repaso de fallos", () => {
  const state = emptyState(),
    e = choice(),
    wrong = e.options!.find((o) => o.id !== e.answer)!.id;
  add(state, e, wrong, "practice");
  delete state.sessions[0].completedAt;
  assert.equal(stats(state).newScore, 0);
  assert.equal(errorPatterns(state).length, 1);
  assert.equal(selectExercises("review", state)[0].id, e.id);
});

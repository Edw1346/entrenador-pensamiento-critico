import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { exercises, skills } from "./bank";
import type { Exercise, SkillId } from "./types";
import {
  STORAGE_KEY,
  emptyState,
  loadState,
  saveState,
  selectExercises,
  newAttempt,
  stats,
  errorPatterns,
  visibleAttempts,
  parseBackup,
  toCsv,
  uid,
  completeAnswer,
} from "./core";
import type { State, Session, Attempt, Mode, Answer } from "./core";
import "./style.css";
const modeNames: Record<Mode, string> = {
  practice: "Práctica",
  diagnostic: "Diagnóstico",
  exam: "Examen",
  review: "Repaso",
  transfer: "Transferencia",
};
const kindNames = {
  choice: "Selección múltiple",
  steps: "Paso a paso",
  open: "Respuesta abierta",
};
const diffNames = ["", "Fundamentos", "Aplicación", "Profundización"];
const formatDate = (date: string) =>
  new Date(date).toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const skillName = (id: string) => skills.find((s) => s.id === id)?.label ?? id;
function download(name: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const [initial] = useState(() => {
    try {
      return loadState(localStorage);
    } catch {
      return {
        state: emptyState(),
        error:
          "El navegador bloqueó el almacenamiento. Puedes trabajar y exportar tu sesión.",
      };
    }
  });
  const [data, setData] = useState<State>(initial.state);
  const [notice, setNotice] = useState(initial.error ?? "");
  const [blocked, setBlocked] = useState(!!initial.error);
  const [page, setPage] = useState("inicio");
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [kind, setKind] = useState("");
  const [imported, setImported] = useState<State | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  function persist(next: State) {
    setData(next);
    if (blocked) {
      setNotice(
        "El almacenamiento original está protegido. Exporta esta sesión o restaura una copia para habilitar el guardado.",
      );
      return;
    }
    try {
      setNotice(saveState(localStorage, next) ?? "");
    } catch {
      setNotice("No se pudo guardar. Descarga una copia antes de cerrar.");
    }
  }
  function navigate(next: string) {
    setActive(null);
    setPage(next);
    window.scrollTo(0, 0);
  }
  function start(mode: Mode, items?: Exercise[]) {
    const selected = items ?? selectExercises(mode, data);
    if (!selected.length) {
      setNotice(
        mode === "exam"
          ? "Ya contestaste todas las preguntas cerradas disponibles. Puedes repasar las conocidas; harán falta nuevos ejercicios para otro examen."
          : "No hay ejercicios disponibles para esta selección.",
      );
      return;
    }
    const session: Session = {
      id: uid(),
      mode,
      exerciseIds: selected.map((e) => e.id),
      startedAt: new Date().toISOString(),
    };
    persist({ ...data, sessions: [...data.sessions, session] });
    setActive(session.id);
    setPage("sesion");
    window.scrollTo(0, 0);
  }
  function record(attempt: Attempt) {
    const attempts = [...data.attempts, attempt];
    const sessions = data.sessions.map((s) =>
      s.id === attempt.sessionId &&
      s.exerciseIds.every((id) =>
        attempts.some((a) => a.sessionId === s.id && a.exerciseId === id),
      )
        ? { ...s, completedAt: new Date().toISOString() }
        : s,
    );
    persist({ ...data, attempts, sessions });
  }
  function appeal(id: string, text: string) {
    persist({
      ...data,
      attempts: data.attempts.map((a) =>
        a.id === id
          ? { ...a, appeal: { text, at: new Date().toISOString() } }
          : a,
      ),
    });
  }
  const overall = stats(data);
  const review = selectExercises("review", data);
  const pending = data.sessions.filter((s) => !s.completedAt).at(-1);
  const lastExam = data.sessions
    .filter((s) => s.mode === "exam" && s.completedAt)
    .at(-1);
  const examDue =
    !lastExam || Date.now() - Date.parse(lastExam.completedAt!) >= 7 * 86400000;
  const session = data.sessions.find((s) => s.id === active);
  const filtered = exercises.filter(
    (e) =>
      (!filter || e.skill === filter) &&
      (!difficulty || e.difficulty === Number(difficulty)) &&
      (!kind || e.kind === kind),
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#inicio"
          onClick={(e) => {
            e.preventDefault();
            navigate("inicio");
          }}
        >
          <span className="brand-icon">c</span>criterio
          <span className="brand-dot">.</span>
        </a>
        <p className="brand-note">Un espacio para pensar mejor</p>
        <nav aria-label="Navegación principal">
          {[
            ["inicio", "◈", "Mi entrenamiento"],
            ["biblioteca", "▦", "Biblioteca"],
            ["progreso", "◷", "Mi progreso"],
            ["historial", "≡", "Historial y datos"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={page === id ? "nav-item selected" : "nav-item"}
              aria-current={page === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="local-mark">✓</span>
          <div>
            <strong>Tu práctica, en tu equipo</strong>
            <p>Sin cuentas. Sin datos enviados.</p>
          </div>
        </div>
      </aside>
      <main id="contenido">
        <header className="topbar">
          <span>ENTRENADOR DE PENSAMIENTO CRÍTICO</span>
          <span className="pill">12 habilidades · a tu ritmo</span>
        </header>
        {notice && (
          <div role="alert" className="notice">
            {notice}
            <button className="text-button" onClick={() => setNotice("")}>
              Cerrar aviso
            </button>
          </div>
        )}
        {page === "inicio" && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">TU ESPACIO DE PRÁCTICA</p>
                <h1>
                  Pensar mejor
                  <br />
                  se practica.
                </h1>
                <p className="lead">
                  Haz buenas preguntas. Examina la evidencia.
                  <br />
                  Construye conclusiones con fundamento.
                </p>
              </div>
              <div className="thinking-art" aria-hidden="true">
                <div className="orbit o1" />
                <div className="orbit o2" />
                <div className="orbit o3" />
                <span className="art-core">?</span>
                <span className="art-label">OBSERVA · CUESTIONA · RAZONA</span>
              </div>
            </div>
            <div className="metrics">
              <Metric
                label="Ejercicios explorados"
                value={`${overall.unique} / ${exercises.length}`}
                detail="Cada problema, otra perspectiva"
              />
              <Metric
                label="Preguntas nuevas"
                value={
                  overall.newScore === null
                    ? "Sin datos"
                    : `${overall.newScore}%`
                }
                detail="Solo evaluación automática"
              />
              <Metric
                label="Por volver a pensar"
                value={review.length}
                detail="Ejercicios pendientes de repaso"
              />
            </div>
            {pending && (
              <div className="resume">
                <div>
                  <strong>Tienes una sesión en curso</strong>
                  <p>
                    {modeNames[pending.mode]} · tus respuestas están guardadas.
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => {
                    setActive(pending.id);
                    setPage("sesion");
                  }}
                >
                  Continuar sesión
                </button>
              </div>
            )}
            <div className="section-title">
              <h2>Elige tu siguiente paso</h2>
              <span>Una práctica consciente, sin prisa</span>
            </div>
            <div className="training-grid">
              <article className="featured">
                <span className="tag light">PUNTO DE PARTIDA</span>
                <h2>Descubre cómo razonas</h2>
                <p>
                  Un diagnóstico de 12 preguntas para explorar cada habilidad.
                  No es una etiqueta: es tu punto de partida.
                </p>
                <div className="card-bottom">
                  <span>12 preguntas · sin límite de tiempo</span>
                  <button
                    className="button white"
                    onClick={() => start("diagnostic")}
                  >
                    {data.sessions.some(
                      (s) => s.mode === "diagnostic" && s.completedAt,
                    )
                      ? "Repetir diagnóstico"
                      : "Comenzar diagnóstico"}
                  </button>
                </div>
              </article>
              <article className="panel practice-card">
                <span className="tile-icon">✳</span>
                <h3>Entrena con intención</h3>
                <p>
                  Explora situaciones, contrasta ideas y aprende del
                  razonamiento detrás de cada respuesta.
                </p>
                <button
                  className="button secondary"
                  onClick={() => navigate("biblioteca")}
                >
                  Explorar ejercicios
                </button>
              </article>
            </div>
            <div className="small-grid">
              <article className="panel">
                <span className="tag">REPASO</span>
                <h3>Los errores también enseñan</h3>
                <p>
                  Vuelve a tus ejercicios pendientes y revisa qué cambió en tu
                  razonamiento.
                </p>
                <button
                  className="text-button"
                  disabled={!review.length}
                  onClick={() => start("review")}
                >
                  Repasar {review.length} ejercicios
                </button>
              </article>
              <article className="panel">
                <span className="tag">TRANSFERENCIA</span>
                <h3>Una situación diferente</h3>
                <p>
                  Aplica tus habilidades a problemas nuevos de aplicación y
                  profundización.
                </p>
                <button
                  className="text-button"
                  onClick={() => start("transfer")}
                >
                  Practicar transferencia
                </button>
              </article>
              <article className="panel">
                <span className="tag">
                  {examDue ? "REVISIÓN SEMANAL DISPONIBLE" : "EXAMEN"}
                </span>
                <h3>Comprueba tu avance</h3>
                <p>
                  Solo preguntas sin contestar. Soluciones al finalizar.{" "}
                  {selectExercises("exam", data).length} áreas disponibles.
                </p>
                <button className="text-button" onClick={() => start("exam")}>
                  Iniciar examen nuevo
                </button>
              </article>
            </div>
            <p className="footer-note">
              No se trata de acertar siempre, sino de entender mejor por qué.
            </p>
          </>
        )}
        {page === "biblioteca" && (
          <>
            <PageTitle
              eyebrow="APRENDER HACIENDO"
              title="Biblioteca de ejercicios"
              description="Casos hipotéticos diseñados para practicar las 12 habilidades. Elige el reto, no solo la respuesta."
            />
            <div className="filters">
              <label>
                Habilidad
                <select
                  aria-label="Habilidad"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">Todas las habilidades</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Dificultad
                <select
                  aria-label="Dificultad"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="">Todos los niveles</option>
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {diffNames[n]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Formato
                <select
                  aria-label="Formato"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="">Todos los formatos</option>
                  {Object.entries(kindNames).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="section-title">
              <h2>{filtered.length} ejercicios para explorar</h2>
              <span>Banco inicial · 48 situaciones</span>
            </div>
            <div className="exercise-grid">
              {filtered.map((e) => (
                <article className="panel exercise-card" key={e.id}>
                  <div className="card-meta">
                    <span className="tag">{skillName(e.skill)}</span>
                    <span>
                      {data.attempts.some((a) => a.exerciseId === e.id)
                        ? "Conocido"
                        : "Nuevo"}
                    </span>
                  </div>
                  <h3>{e.title}</h3>
                  <p>{e.objective}</p>
                  <div className="exercise-foot">
                    <span>
                      {diffNames[e.difficulty]} · {kindNames[e.kind]}
                    </span>
                    <button
                      className="button secondary"
                      onClick={() => start("practice", [e])}
                    >
                      Practicar
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!filtered.length && (
              <Empty text="No hay ejercicios con estos filtros." />
            )}
          </>
        )}
        {page === "sesion" && session && (
          <SessionView
            key={session.id}
            session={session}
            data={data}
            onRecord={record}
            onAppeal={appeal}
            onExit={() => navigate("inicio")}
            onTransfer={(skill) =>
              start("transfer", selectExercises("transfer", data, skill))
            }
          />
        )}
        {page === "progreso" && (
          <>
            <PageTitle
              eyebrow="EVIDENCIA DE TU PRÁCTICA"
              title="Tu progreso, por habilidad"
              description="Las puntuaciones describen estos ejercicios. Una muestra pequeña no permite inferir tu capacidad general."
            />
            <div className="metrics">
              <Metric
                label="Nuevas · automáticas"
                value={
                  overall.newScore === null
                    ? "Sin datos"
                    : `${overall.newScore}%`
                }
                detail="Primer intento de cada ejercicio"
              />
              <Metric
                label="Conocidas · automáticas"
                value={
                  overall.knownScore === null
                    ? "Sin datos"
                    : `${overall.knownScore}%`
                }
                detail="Incluye repeticiones y correcciones"
              />
              <Metric
                label="Autoevaluación"
                value={
                  overall.selfScore === null
                    ? "Sin datos"
                    : `${overall.selfScore}%`
                }
                detail="Respuestas abiertas, por rúbrica"
              />
            </div>
            <div className="panel table-wrap">
              <table>
                <caption>Resultados independientes por área</caption>
                <thead>
                  <tr>
                    <th>Habilidad</th>
                    <th>Diagnóstico*</th>
                    <th>Nuevas</th>
                    <th>Conocidas</th>
                    <th>Autoevaluación</th>
                    <th>Intentos</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.map((s) => {
                    const v = stats(data, s.id);
                    return (
                      <tr key={s.id}>
                        <th scope="row">
                          {s.label}
                          <div className="progress-track">
                            <div style={{ width: `${v.newScore ?? 0}%` }} />
                          </div>
                        </th>
                        <td>{percent(v.diagnostic)}</td>
                        <td>{percent(v.newScore)}</td>
                        <td>{percent(v.knownScore)}</td>
                        <td>{percent(v.selfScore)}</td>
                        <td>{v.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="muted">
                *Media de respuestas iniciales en diagnósticos, sin
                correcciones. Repetirlos puede reflejar familiaridad.
              </p>
            </div>
            <div className="section-title">
              <h2>Patrones que merecen atención</h2>
            </div>
            <p className="muted">
              Intentos inferiores a 70%, agrupados por habilidad. Incluye
              repeticiones y autoevaluaciones; no es un diagnóstico de sesgos.
            </p>
            <div className="small-grid">
              {errorPatterns(data).map((s) => (
                <article className="panel" key={s.id}>
                  <h3>{s.label}</h3>
                  <p>{s.count} intentos con dificultades.</p>
                  <ul className="pattern-list">
                    {exercises
                      .filter(
                        (e) =>
                          e.skill === s.id &&
                          visibleAttempts(data).some(
                            (a) =>
                              a.exerciseId === e.id &&
                              a.score < 70 &&
                              !a.correctionOf,
                          ),
                      )
                      .map((e) => (
                        <li key={e.id}>
                          <strong>{e.title}</strong> ·{" "}
                          {
                            visibleAttempts(data).filter(
                              (a) =>
                                a.exerciseId === e.id &&
                                a.score < 70 &&
                                !a.correctionOf,
                            ).length
                          }{" "}
                          intentos
                          <details>
                            <summary>Posibles errores para revisar</summary>
                            {e.commonErrors.map((error) => (
                              <p key={error}>{error}</p>
                            ))}
                          </details>
                        </li>
                      ))}
                  </ul>
                  <button
                    className="text-button"
                    onClick={() => {
                      setFilter(s.id);
                      navigate("biblioteca");
                    }}
                  >
                    Practicar esta habilidad
                  </button>
                </article>
              ))}
            </div>
            {!errorPatterns(data).length && (
              <Empty text="Los patrones aparecerán cuando registres respuestas con dificultades." />
            )}
          </>
        )}
        {page === "historial" && (
          <>
            <PageTitle
              eyebrow="TU RECORRIDO"
              title="Historial y datos"
              description="Conserva tus respuestas, revisa tus criterios y lleva contigo una copia de tu aprendizaje."
            />
            <div className="panel data-panel">
              <h2>Tu copia de seguridad</h2>
              <p>
                Los datos se guardan en este navegador. Borrar sus datos o
                cambiar de equipo no los transfiere. Descarga un JSON para poder
                recuperarlos.
              </p>
              <div className="actions">
                <button
                  className="button primary"
                  onClick={() =>
                    download(
                      "criterio-respaldo.json",
                      JSON.stringify(data, null, 2),
                    )
                  }
                >
                  Exportar JSON
                </button>
                <button
                  className="button secondary"
                  onClick={() =>
                    download(
                      "criterio-resultados.csv",
                      toCsv(data),
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  Exportar CSV
                </button>
                <label className="button secondary file-label">
                  Importar JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        if (file.size > 5_000_000)
                          throw new Error("El archivo excede 5 MB.");
                        setImported(parseBackup(await file.text()));
                      } catch (err) {
                        setNotice((err as Error).message);
                      }
                    }}
                  />
                </label>
                <button
                  className="text-button danger"
                  onClick={() => setDeleteConfirm(true)}
                >
                  Eliminar mis datos
                </button>
              </div>
              {blocked && (
                <button
                  className="text-button"
                  onClick={() => {
                    try {
                      download(
                        "criterio-almacenamiento-original.txt",
                        localStorage.getItem(STORAGE_KEY) ?? "",
                        "text/plain",
                      );
                    } catch {
                      setNotice(
                        "El navegador no permite leer el almacenamiento original.",
                      );
                    }
                  }}
                >
                  Exportar almacenamiento original
                </button>
              )}
              {imported && (
                <div className="notice">
                  <p>
                    La copia contiene {imported.attempts.length} intentos.
                    Restaurarla reemplazará los datos actuales.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => {
                      try {
                        const error = saveState(localStorage, imported);
                        if (error) {
                          setNotice(error);
                          return;
                        }
                        setBlocked(false);
                        setData(imported);
                        setImported(null);
                        setNotice("Copia restaurada correctamente.");
                      } catch {
                        setNotice("No fue posible guardar la copia.");
                      }
                    }}
                  >
                    Confirmar restauración
                  </button>{" "}
                  <button
                    className="text-button"
                    onClick={() => setImported(null)}
                  >
                    Cancelar
                  </button>
                </div>
              )}
              {deleteConfirm && (
                <div className="notice">
                  <p>
                    ¿Eliminar todo el historial y las sesiones de este
                    navegador? Esta acción no se puede deshacer sin un respaldo.
                  </p>
                  <button
                    className="button danger-button"
                    onClick={() => {
                      try {
                        localStorage.removeItem(STORAGE_KEY);
                        setBlocked(false);
                        setData(emptyState());
                        setDeleteConfirm(false);
                        setNotice("Datos eliminados.");
                      } catch {
                        setNotice("No se pudo eliminar el almacenamiento.");
                      }
                    }}
                  >
                    Confirmar eliminación
                  </button>{" "}
                  <button
                    className="text-button"
                    onClick={() => setDeleteConfirm(false)}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            <div className="section-title">
              <h2>{data.attempts.length} intentos registrados</h2>
              <span>Del más reciente al más antiguo</span>
            </div>
            {[...data.attempts].reverse().map((a) => {
              const e = exercises.find((e) => e.id === a.exerciseId)!;
              return (
                <details key={a.id} className="panel history-item">
                  <summary>
                    <div>
                      <strong>{e.title}</strong>
                      <p>
                        {formatDate(a.at)} · {modeNames[a.mode]} ·{" "}
                        {a.isNew ? "Nuevo" : "Conocido"}
                        {a.correctionOf ? " · Corrección" : ""}
                      </p>
                    </div>
                    <span className="score">
                      {["exam", "diagnostic"].includes(a.mode) &&
                      !data.sessions.find((s) => s.id === a.sessionId)
                        ?.completedAt
                        ? "Pendiente"
                        : `${a.score}%`}
                    </span>
                  </summary>
                  <p>
                    <strong>Respuesta guardada:</strong>{" "}
                    {answerLabel(e, a.answer)}
                  </p>
                  {a.assessment && (
                    <p>Autoevaluación: {a.assessment.reasons.join(" · ")}</p>
                  )}
                  {data.sessions.find((s) => s.id === a.sessionId)
                    ?.completedAt ||
                  !["exam", "diagnostic"].includes(a.mode) ? (
                    <Feedback e={e} attempt={a} onAppeal={appeal} />
                  ) : (
                    <p>
                      Las soluciones y la evaluación detallada estarán
                      disponibles al finalizar la sesión.
                    </p>
                  )}
                </details>
              );
            })}
            {!data.attempts.length && (
              <Empty text="Aún no hay intentos. Tu primera respuesta iniciará este recorrido." />
            )}
          </>
        )}
        <footer className="app-footer">
          Criterio · Aprender a razonar, un ejercicio a la vez.
          <span>Local · Sin IA · Sin rastreo</span>
        </footer>
      </main>
    </div>
  );
}
function percent(v: number | null) {
  return v === null ? "—" : `${v}%`;
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="lead">{description}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <span aria-hidden="true">◌</span>
      <p>{text}</p>
    </div>
  );
}
function answerLabel(e: Exercise, a: Answer) {
  if (e.kind === "choice")
    return e.options?.find((o) => o.id === a)?.text ?? String(a);
  if (e.kind === "steps")
    return e.steps
      ?.map(
        (s, i) =>
          `${i + 1}. ${s.options.find((o) => o.id === a[i])?.text ?? a[i]}`,
      )
      .join(" · ");
  return String(a);
}
function SessionView({
  session,
  data,
  onRecord,
  onAppeal,
  onExit,
  onTransfer,
}: {
  session: Session;
  data: State;
  onRecord: (a: Attempt) => void;
  onAppeal: (id: string, text: string) => void;
  onExit: () => void;
  onTransfer: (s: SkillId) => void;
}) {
  const attempts = data.attempts.filter((a) => a.sessionId === session.id);
  const locked = ["exam", "diagnostic"].includes(session.mode);
  const nextIndex = session.exerciseIds.findIndex(
    (id) => !attempts.some((a) => a.exerciseId === id),
  );
  const [practiceIndex, setPracticeIndex] = useState(() =>
    Math.max(0, nextIndex),
  );
  const [correction, setCorrection] = useState<string | undefined>();
  const [showSummary, setShowSummary] = useState(
    locked && !!session.completedAt,
  );
  const index = locked
    ? nextIndex < 0
      ? session.exerciseIds.length
      : nextIndex
    : practiceIndex;
  const e = exercises.find(
    (e) =>
      e.id ===
      session.exerciseIds[Math.min(index, session.exerciseIds.length - 1)],
  )!;
  const prior = attempts.filter((a) => a.exerciseId === e.id).at(-1);
  const finished = locked && nextIndex < 0;
  if (finished || showSummary) {
    const first = session.exerciseIds
      .map((id) => attempts.find((a) => a.exerciseId === id))
      .filter((a): a is Attempt => !!a);
    return (
      <>
        <PageTitle
          eyebrow={modeNames[session.mode].toUpperCase()}
          title="Una pausa para entender"
          description={`${first.length} ejercicios respondidos. Revisa el razonamiento detrás de cada resultado.`}
        />
        <div className="resume">
          <strong>
            Resultado inicial:{" "}
            {Math.round(
              first.reduce((s, a) => s + a.score, 0) /
                Math.max(1, first.length),
            )}
            %
          </strong>
          <button className="button primary" onClick={onExit}>
            Volver al inicio
          </button>
        </div>
        {first.map((a) => {
          const ex = exercises.find((e) => e.id === a.exerciseId)!;
          return (
            <article className="panel result-card" key={a.id}>
              <div className="section-title">
                <h2>{skillName(ex.skill)}</h2>
                <span className="score">{a.score}%</span>
              </div>
              <h3>{ex.title}</h3>
              <p>{ex.prompt}</p>
              <p>
                <strong>Tu respuesta:</strong> {answerLabel(ex, a.answer)}
              </p>
              <Feedback e={ex} attempt={a} onAppeal={onAppeal} />
              <p className="muted">
                Puedes volver a este ejercicio desde la biblioteca para
                practicar con la explicación.
              </p>
            </article>
          );
        })}
      </>
    );
  }
  return (
    <>
      <div className="session-top">
        <button className="text-button" onClick={onExit}>
          Guardar y salir
        </button>
        <span>
          {modeNames[session.mode]} ·{" "}
          {Math.min(index + 1, session.exerciseIds.length)} de{" "}
          {session.exerciseIds.length}
        </span>
      </div>
      <progress
        aria-label="Progreso de la sesión"
        value={index}
        max={session.exerciseIds.length}
      />
      {locked && (
        <div className="exam-note">
          Modo {modeNames[session.mode].toLowerCase()}: soluciones y resultados
          al terminar. {session.exerciseIds.length} habilidades cubiertas. Sin
          límite de tiempo.
        </div>
      )}
      <div className="exercise-layout">
        <article className="panel question-panel">
          <div className="card-meta">
            <span className="tag">{skillName(e.skill)}</span>
            <span>{diffNames[e.difficulty]}</span>
          </div>
          <h1 className="question-title">{e.title}</h1>
          <p className="objective">Objetivo: {e.objective}</p>
          <div className="prompt">{e.prompt}</div>
          {prior && !correction && !locked ? (
            <>
              <p>
                <strong>Tu respuesta:</strong> {answerLabel(e, prior.answer)}
              </p>
              <Feedback e={e} attempt={prior} onAppeal={onAppeal} />
              <div className="actions">
                <button
                  className="button secondary"
                  onClick={() => setCorrection(prior.id)}
                >
                  Corregir mi respuesta
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    if (index + 1 < session.exerciseIds.length) {
                      setPracticeIndex(index + 1);
                      setCorrection(undefined);
                    } else setShowSummary(true);
                  }}
                >
                  {index + 1 < session.exerciseIds.length
                    ? "Siguiente ejercicio"
                    : "Ver resumen"}
                </button>
                <button
                  className="text-button"
                  onClick={() => onTransfer(e.skill)}
                >
                  Otro contexto nuevo
                </button>
              </div>
            </>
          ) : (
            <AnswerForm
              key={`${e.id}-${correction ?? "first"}`}
              e={e}
              locked={locked}
              onSubmit={(answer, assessment) => {
                onRecord(
                  newAttempt(data, e, answer, session, assessment, correction),
                );
                setCorrection(undefined);
              }}
            />
          )}
        </article>
        <aside className="panel rubric-panel">
          <p className="eyebrow">CÓMO SE EVALÚA</p>
          <h2>Haz visible tu razonamiento</h2>
          {e.rubric.map((c, i) => (
            <div className="criterion" key={c.id}>
              <span>{i + 1}</span>
              <div>
                <strong>{c.label}</strong>
                <p>{c.description}</p>
              </div>
            </div>
          ))}
          <div className="rubric-note">
            {e.kind === "open"
              ? "Autoevaluación: 0 ausente · 1 parcial · 2 completo. Cada criterio pesa lo mismo. No se usa IA."
              : e.kind === "choice"
                ? "Puntuación automática: 100% si eliges la respuesta correcta, 0% en otro caso. Los criterios explican el razonamiento esperado."
                : "Puntuación automática: porcentaje de pasos correctos; todos pesan lo mismo."}
          </div>
          <p className="muted">
            Una conclusión con la que discrepas no es, por sí sola, una falacia.
            Separa validez, premisas y evidencia.
          </p>
        </aside>
      </div>
    </>
  );
}
function AnswerForm({
  e,
  locked,
  onSubmit,
}: {
  e: Exercise;
  locked: boolean;
  onSubmit: (
    a: Answer,
    assessment?: { scores: number[]; reasons: string[] },
  ) => void;
}) {
  const [answer, setAnswer] = useState<Answer>(
    e.kind === "steps" ? e.steps!.map(() => "") : "",
  );
  const [frozen, setFrozen] = useState(false);
  const [scores, setScores] = useState<number[]>(e.rubric.map(() => -1));
  const [reasons, setReasons] = useState<string[]>(e.rubric.map(() => ""));
  const [error, setError] = useState("");
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!completeAnswer(e, answer)) {
      setError(
        e.kind === "open"
          ? "Escribe al menos 30 caracteres y como máximo 10.000."
          : "Responde todas las partes antes de continuar.",
      );
      return;
    }
    if (e.kind === "open" && !frozen) {
      setFrozen(true);
      setError("");
      return;
    }
    if (
      e.kind === "open" &&
      (scores.includes(-1) || reasons.some((r) => r.trim().length < 10))
    ) {
      setError(
        "Selecciona una puntuación y justifica cada criterio con al menos 10 caracteres.",
      );
      return;
    }
    onSubmit(answer, e.kind === "open" ? { scores, reasons } : undefined);
  }
  return (
    <form onSubmit={submit}>
      {e.kind === "choice" && (
        <fieldset>
          <legend>Elige la conclusión mejor justificada</legend>
          {e.options!.map((o) => (
            <label
              className={`option ${answer === o.id ? "checked" : ""}`}
              key={o.id}
            >
              <input
                type="radio"
                name="answer"
                value={o.id}
                checked={answer === o.id}
                onChange={() => setAnswer(o.id)}
              />
              <span>{o.text}</span>
            </label>
          ))}
        </fieldset>
      )}
      {e.kind === "steps" &&
        e.steps!.map((step, i) => (
          <fieldset key={i}>
            <legend>
              Paso {i + 1}. {step.prompt}
            </legend>
            {step.options.map((o) => (
              <label
                className={`option ${answer[i] === o.id ? "checked" : ""}`}
                key={o.id}
              >
                <input
                  type="radio"
                  name={`step-${i}`}
                  checked={answer[i] === o.id}
                  onChange={() => {
                    const next = [...answer];
                    next[i] = o.id;
                    setAnswer(next);
                  }}
                />
                <span>{o.text}</span>
              </label>
            ))}
          </fieldset>
        ))}
      {e.kind === "open" && (
        <>
          <label className="input-label" htmlFor="free-answer">
            Tu argumento <span>(30–10.000 caracteres)</span>
          </label>
          <textarea
            id="free-answer"
            value={answer as string}
            maxLength={10000}
            disabled={frozen}
            onChange={(ev) => setAnswer(ev.target.value)}
            rows={7}
            placeholder="Expón tu conclusión, las razones que la sostienen y qué información podría cambiarla…"
          />
          {frozen && (
            <div className="self-assessment">
              <h2>Compara y justifica tu evaluación</h2>
              <p>
                Tu respuesta quedó fijada. Esta puntuación la asignas tú; se
                registrará como autoevaluación.
              </p>
              <div className="model-answer">
                <strong>Respuesta orientativa</strong>
                <p>{e.modelAnswer}</p>
              </div>
              {e.rubric.map((c, i) => (
                <div className="assessment-row" key={c.id}>
                  <label>
                    {c.label}
                    <select
                      aria-label={c.label}
                      value={scores[i]}
                      onChange={(ev) => {
                        const next = [...scores];
                        next[i] = Number(ev.target.value);
                        setScores(next);
                      }}
                    >
                      <option value={-1}>Selecciona una puntuación</option>
                      <option value={0}>0 · Ausente o incorrecto</option>
                      <option value={1}>1 · Parcial</option>
                      <option value={2}>2 · Completo y justificado</option>
                    </select>
                  </label>
                  <label>
                    Motivo para «{c.label}»
                    <textarea
                      maxLength={2000}
                      rows={2}
                      value={reasons[i]}
                      onChange={(ev) => {
                        const next = [...reasons];
                        next[i] = ev.target.value;
                        setReasons(next);
                      }}
                      placeholder="Cita qué parte de tu respuesta cumple o no cumple el criterio."
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <button className="button primary submit" type="submit">
        {e.kind === "open"
          ? frozen
            ? "Guardar autoevaluación"
            : "Fijar respuesta y comparar"
          : locked
            ? "Guardar respuesta y continuar"
            : "Evaluar respuesta"}
      </button>
    </form>
  );
}
function Feedback({
  e,
  attempt,
  onAppeal,
}: {
  e: Exercise;
  attempt: Attempt;
  onAppeal: (id: string, text: string) => void;
}) {
  const [show, setShow] = useState(false);
  const [text, setText] = useState(attempt.appeal?.text ?? "");
  return (
    <div className="feedback">
      <div className="feedback-heading">
        <span className={`score ${attempt.score >= 70 ? "good" : ""}`}>
          {attempt.score}%
        </span>
        <h3>
          {attempt.method === "self"
            ? "Autoevaluación registrada"
            : attempt.score === 100
              ? "Respuesta correcta"
              : attempt.score === 0
                ? "Revisa la inferencia"
                : "Respuesta parcialmente correcta"}
        </h3>
      </div>
      <p>
        <strong>Respuesta esperada:</strong> {e.modelAnswer}
      </p>
      <p>{e.explanation}</p>
      {e.kind === "steps" &&
        e.steps!.map((s, i) => (
          <p key={i}>
            <strong>
              Paso {i + 1} ·{" "}
              {attempt.answer[i] === s.answer ? "Correcto" : "Por revisar"}:
            </strong>{" "}
            {s.explanation}
          </p>
        ))}
      {attempt.assessment &&
        e.rubric.map((c, i) => (
          <p key={c.id}>
            <strong>
              {c.label}: {attempt.assessment!.scores[i]}/2.
            </strong>{" "}
            {attempt.assessment!.reasons[i]}
          </p>
        ))}
      <details>
        <summary>Errores frecuentes y un reto mayor</summary>
        <ul>
          {e.commonErrors.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p>
          <strong>Para profundizar:</strong> {e.harderVariant}
        </p>
      </details>
      {attempt.appeal && (
        <div className="appeal-saved">
          <strong>Objeción registrada</strong>
          <p>{attempt.appeal.text}</p>
          <small>
            Nota personal para contrastar con la rúbrica. No se ha enviado a un
            evaluador ni alterado la puntuación.
          </small>
        </div>
      )}
      <button className="text-button" onClick={() => setShow(!show)}>
        {attempt.appeal
          ? "Editar mi objeción"
          : "Impugnar / comentar evaluación"}
      </button>
      {show && (
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            if (text.trim().length >= 10) {
              onAppeal(attempt.id, text.trim());
              setShow(false);
            }
          }}
        >
          <label>
            Explica qué criterio o razonamiento cuestionas
            <textarea
              required
              minLength={10}
              maxLength={3000}
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              rows={3}
            />
          </label>
          <button className="button secondary" type="submit">
            Guardar objeción
          </button>
        </form>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

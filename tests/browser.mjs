import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { exercises } from "../src/bank.ts";
const root = new URL("../", import.meta.url).pathname;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "5187",
    "--strictPort",
  ],
  { cwd: root, stdio: "pipe" },
);
let serverOutput = "";
server.stderr.on("data", (d) => (serverOutput += d));
server.stdout.on("data", (d) => (serverOutput += d));
const checks = [];
checks.push = (message) => {
  console.log("PASS", message);
  return Array.prototype.push.call(checks, message);
};
let browser;
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5187")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(ready, serverOutput);
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    ...(process.env.CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5187");
  await page.getByRole("heading", { name: /Pensar mejor/ }).waitFor();
  await mkdir("docs/qa", { recursive: true });
  await page.screenshot({ path: "docs/qa/inicio-desktop.png", fullPage: true });
  checks.push("Inicio sin datos y captura de escritorio");
  await page
    .getByRole("button", { name: "Comenzar diagnóstico", exact: true })
    .click();
  const diagnostic = exercises.filter((e) => e.id.endsWith("-1"));
  for (let i = 0; i < diagnostic.length; i++) {
    const e = diagnostic[i];
    await page.getByRole("heading", { name: e.title, exact: true }).waitFor();
    await page
      .getByRole("radio", {
        name: e.options.find((o) => o.id === e.answer).text,
        exact: true,
      })
      .check();
    await page
      .getByRole("button", { name: "Guardar respuesta y continuar" })
      .click();
    if (i === 0) {
      assert.equal(
        await page.getByText("Respuesta esperada:", { exact: false }).count(),
        0,
      );
      await page.getByRole("button", { name: "Guardar y salir" }).click();
      await page
        .getByRole("button", { name: "Historial y datos", exact: false })
        .click();
      assert.equal(
        await page.getByText("Pendiente", { exact: true }).count(),
        1,
      );
      await page.locator("details.history-item > summary").click();
      assert.equal(
        await page.getByText("Respuesta esperada:", { exact: false }).count(),
        0,
      );
      await page.reload();
      await page
        .getByRole("button", { name: "Mi entrenamiento", exact: false })
        .click();
      await page.getByRole("button", { name: "Continuar sesión" }).click();
    }
  }
  await page
    .getByRole("heading", { name: "Una pausa para entender" })
    .waitFor();
  assert.ok(
    await page.getByText("Resultado inicial: 100%", { exact: false }).count(),
  );
  assert.equal(
    await page.getByText("Respuesta esperada:", { exact: false }).count(),
    12,
  );
  checks.push(
    "Diagnóstico: 12 áreas, soluciones ocultas incluso en historial, recarga y resultado 100%",
  );
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await page.getByRole("button", { name: "Iniciar examen nuevo" }).click();
  let state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("criterio-v1")),
  );
  const exam = state.sessions.at(-1);
  assert.equal(exam.exerciseIds.length, 12);
  assert.ok(
    exam.exerciseIds.every((id) => !diagnostic.some((e) => e.id === id)),
  );
  checks.push("Examen elige 12 preguntas nuevas después del diagnóstico");
  await page.getByRole("button", { name: "Guardar y salir" }).click();
  await page.getByRole("button", { name: "Biblioteca", exact: false }).click();
  await page.getByLabel("Habilidad", { exact: true }).selectOption("deduction");
  assert.equal(
    await page.getByRole("button", { name: "Practicar", exact: true }).count(),
    4,
  );
  await page.getByLabel("Dificultad", { exact: true }).selectOption("2");
  await page.getByLabel("Formato", { exact: true }).selectOption("choice");
  assert.equal(
    await page.getByRole("button", { name: "Practicar", exact: true }).count(),
    1,
  );
  await page.getByRole("button", { name: "Practicar", exact: true }).click();
  const choice = exercises.find((e) => e.id === "deduction-2");
  await page
    .getByRole("radio", {
      name: choice.options.find((o) => o.id !== choice.answer).text,
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Evaluar respuesta" }).click();
  await page.getByRole("heading", { name: "Revisa la inferencia" }).waitFor();
  await page
    .getByRole("button", { name: "Impugnar / comentar evaluación" })
    .click();
  await page
    .getByLabel("Explica qué criterio o razonamiento cuestionas")
    .fill("Quiero contrastar esta premisa con el criterio de validez.");
  await page.getByRole("button", { name: "Guardar objeción" }).click();
  await page.getByText("Objeción registrada", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Corregir mi respuesta" }).click();
  await page
    .getByRole("radio", {
      name: choice.options.find((o) => o.id === choice.answer).text,
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Evaluar respuesta" }).click();
  await page
    .getByRole("heading", { name: "Respuesta correcta", exact: true })
    .waitFor();
  state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("criterio-v1")),
  );
  assert.ok(state.attempts.at(-1).correctionOf);
  assert.equal(state.attempts.at(-1).isNew, false);
  checks.push(
    "Filtros, error, objeción, corrección y vínculo al intento original",
  );
  await page.getByRole("button", { name: "Biblioteca", exact: false }).click();
  await page.getByLabel("Dificultad", { exact: true }).selectOption("3");
  await page.getByLabel("Formato", { exact: true }).selectOption("open");
  await page.getByRole("button", { name: "Practicar", exact: true }).click();
  await page
    .getByRole("button", { name: "Fijar respuesta y comparar" })
    .click();
  await page.getByRole("alert").waitFor();
  await page
    .getByLabel("Tu argumento", { exact: false })
    .fill(
      "La conclusión debe seguir de las premisas, aunque su verdad no esté demostrada. Debemos separar la validez lógica de la evidencia disponible.",
    );
  await page
    .getByRole("button", { name: "Fijar respuesta y comparar" })
    .click();
  assert.ok(
    await page.getByLabel("Tu argumento", { exact: false }).isDisabled(),
  );
  const open = exercises.find((e) => e.id === "deduction-4");
  for (const c of open.rubric) {
    await page.getByLabel(c.label, { exact: true }).selectOption("1");
    await page
      .getByLabel(`Motivo para «${c.label}»`, { exact: true })
      .fill(
        "Mi respuesta incluye una distinción, pero falta justificarla con un ejemplo.",
      );
  }
  await page.getByRole("button", { name: "Guardar autoevaluación" }).click();
  await page
    .getByRole("heading", { name: "Autoevaluación registrada" })
    .waitFor();
  state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("criterio-v1")),
  );
  assert.equal(state.attempts.at(-1).score, 50);
  assert.equal(state.attempts.at(-1).method, "self");
  checks.push(
    "Abierta: validación, texto fijado, rúbrica justificada y nota separada",
  );
  await page.getByRole("button", { name: "Biblioteca", exact: false }).click();
  await page.getByLabel("Dificultad", { exact: true }).selectOption("2");
  await page.getByLabel("Formato", { exact: true }).selectOption("steps");
  await page.getByRole("button", { name: "Practicar", exact: true }).click();
  const stepped = exercises.find((e) => e.id === "deduction-3");
  for (let i = 0; i < stepped.steps.length; i++) {
    const s = stepped.steps[i];
    await page
      .locator("fieldset")
      .nth(i)
      .getByRole("radio", {
        name: s.options.find((o) => o.id === s.answer).text,
        exact: true,
      })
      .check();
  }
  await page.getByRole("button", { name: "Evaluar respuesta" }).click();
  await page
    .getByRole("heading", { name: "Respuesta correcta", exact: true })
    .waitFor();
  checks.push("Ejercicio por pasos completo");
  await page
    .getByRole("button", { name: "Historial y datos", exact: false })
    .click();
  const backup = await page.evaluate(() => localStorage.getItem("criterio-v1"));
  const dlEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar JSON" }).click();
  assert.equal((await dlEvent).suggestedFilename(), "criterio-respaldo.json");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{bad"),
    });
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "Eliminar mis datos" }).click();
  await page.getByRole("button", { name: "Confirmar eliminación" }).click();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("criterio-v1")),
    null,
  );
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup),
    });
  await page.getByRole("button", { name: "Confirmar restauración" }).click();
  await page.reload();
  assert.deepEqual(
    JSON.parse(await page.evaluate(() => localStorage.getItem("criterio-v1"))),
    JSON.parse(backup),
  );
  checks.push(
    "Exportar, rechazar JSON corrupto, borrar, importar y persistir tras recarga",
  );
  await page.getByRole("button", { name: "Mi progreso", exact: false }).click();
  assert.equal(await page.locator("tbody tr").count(), 12);
  await page.screenshot({
    path: "docs/qa/progreso-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Mi entrenamiento", exact: false })
    .click();
  await page.screenshot({ path: "docs/qa/inicio-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.getByRole("button", { name: "Biblioteca", exact: false }).click();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.keyboard.press("Tab");
  assert.ok(
    await page.evaluate(() => document.activeElement !== document.body),
  );
  checks.push("Progreso 12 áreas; móvil 390px sin desborde; foco por teclado");
  assert.deepEqual(errors, []);
  checks.push("Sin errores JavaScript en la consola");
  await writeFile(
    "docs/qa/resultados.json",
    JSON.stringify({ checks, passed: checks.length }, null, 2),
  );
  console.log(checks.map((c) => "PASS " + c).join("\n"));
} finally {
  await browser?.close();
  server.kill();
}

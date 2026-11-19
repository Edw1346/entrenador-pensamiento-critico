# Criterio · Entrenador de pensamiento crítico

Aplicación local en español para practicar 12 habilidades mediante 48 ejercicios razonados. Incluye diagnóstico por área, selección múltiple, pasos, respuestas abiertas, rúbricas, correcciones, objeciones, exámenes nuevos, transferencia, historial y respaldos. Sin IA, cuentas, telemetría ni claves.

## Abrir la entrega preparada (opción sencilla)

1. Descarga este repositorio con **Code → Download ZIP** en GitHub y descomprímelo (o usa la entrega `criterio.zip`). No abras `dist/index.html` con doble clic: debe servirse por HTTP.
2. Si tienes Python 3, abre una terminal en la carpeta que contiene `iniciar.py`.
3. Ejecuta `python iniciar.py` en Windows o `python3 iniciar.py` en Linux/macOS.
4. Se abrirá **http://127.0.0.1:5186**. Si no se abre, copia esa dirección al navegador.
5. Mantén la terminal abierta mientras usas la aplicación. `Ctrl+C` detiene el servidor.

Python solo sirve los archivos en tu equipo. Las respuestas se guardan en el navegador, no en el servidor. Usa siempre el mismo navegador y dirección para encontrar tus datos.

## Instalar desde el código fuente

Requiere Node.js **24 o posterior** (incluye npm). Abre una terminal en la carpeta del proyecto:

```sh
npm install
npm run dev
```

Abre http://127.0.0.1:5186. Para generar y servir la compilación:

```sh
npm run build
npm start
```

No ejecutes `dev`, `start` y `iniciar.py` al mismo tiempo: usan el mismo puerto para conservar el origen de almacenamiento. Las dependencias están fijadas en `package.json` y `pnpm-lock.yaml`; con pnpm 10 puedes usar `pnpm install --frozen-lockfile`. No se requiere ningún archivo `.env`.

## Manual breve

- **Mi entrenamiento:** comienza un diagnóstico de 12 preguntas; sus soluciones aparecen cuando respondes todas. Puedes guardar y salir, cerrar y recuperar la sesión.
- **Biblioteca:** filtra por habilidad, dificultad y formato. Lee el objetivo y la rúbrica antes de responder.
- **Práctica:** las cerradas se corrigen automáticamente. Los ejercicios por pasos conceden crédito proporcional. Puedes corregir, conservando el intento original.
- **Abiertas:** escribe al menos 30 caracteres, fija la respuesta, compara el modelo y puntúa cada criterio de 0 a 2. Justifica cada nota. Esto es **autoevaluación**, sin IA ni evaluador humano oculto.
- **Impugnar:** guarda una objeción junto al intento y contrástala con los criterios. No cambia la nota automáticamente ni envía solicitudes a terceros. Puedes corregir o volver a autoevaluarte con un intento nuevo.
- **Transferencia:** problemas sin contestar de dificultad media o alta, en contextos diferentes. Las variantes de texto adicionales sirven como reflexión, sin nota automática.
- **Repaso:** ejercicios cuyo último intento es inferior a 70%. Un resultado posterior suficiente los retira del repaso, pero preserva el historial.
- **Examen:** una pregunta cerrada no contestada por habilidad disponible, hasta 12. Se informa cuántas áreas incluye. Al agotarlas, no inventa preguntas ni repite sin advertir. El inicio indica revisión semanal según el último examen finalizado; no hay notificaciones externas.
- **Mi progreso:** compara preguntas nuevas, conocidas y autoevaluaciones separadamente. El diagnóstico es orientativo: una pregunta por área no mide de forma fiable una capacidad general.

## Respaldo, recuperación y privacidad

En **Historial y datos**, usa **Exportar JSON** periódicamente. Incluye respuestas, criterios, objeciones e historial. **Exportar CSV** sirve para análisis, pero no para restaurar. **Importar JSON** valida la copia y pide confirmar antes de reemplazar datos. Exporta antes de importar. **Eliminar mis datos** exige confirmación.

Los datos pertenecen al origen `http://127.0.0.1:5186`. Cambiar a `localhost`, cambiar puerto, usar modo privado, otro navegador o eliminar sus datos puede hacer que el historial no esté disponible. No hay sincronización, cifrado propio ni recuperación remota. Evita introducir información sensible y guarda las copias en un lugar privado.

Si el almacenamiento se corrompe, la app muestra un aviso y protege el contenido original. En Historial puedes exportarlo como texto, descargar el trabajo nuevo y restaurar una copia válida. Si el navegador bloquea el guardado o se llena, exporta antes de cerrar.

## Ejecutar las pruebas

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Las pruebas de navegador arrancan su propio servidor en el puerto 5187, usan un perfil aislado y no leen tu historial personal. Si Chromium ya está instalado, puedes indicar `CHROMIUM_EXECUTABLE` con su ruta. Generan capturas y resultados en `docs/qa/`.

Consulta [VERIFICACION.md](docs/VERIFICACION.md) para pruebas efectivamente ejecutadas y límites, y [ESPECIFICACION.md](docs/ESPECIFICACION.md) para requisitos, pantallas, modelo y reglas.

## Estructura

```text
src/
  types.ts        Contratos de ejercicios y habilidades
  bank.ts         Banco editorial de 48 ejercicios
  core.ts         Puntuación, selección, datos y validaciones
  main.tsx        Pantallas y flujos React
  style.css       Interfaz adaptable y estilos de foco
 tests/           Pruebas de lógica y navegador
 docs/            Especificación y verificación
 dist/            Compilación lista para servir
 iniciar.py       Inicio local con Python
```

## Mantenimiento y límites

Para añadir ejercicios, sigue `Exercise` en `types.ts`, asigna IDs únicos y conserva los IDs publicados para no romper copias. El diagnóstico usa los IDs terminados en `-1`: conserva uno por habilidad. Actualiza las pruebas de tamaño del banco si lo amplías. Antes de actualizar, exporta JSON; instala dependencias y ejecuta pruebas y build. No borres intentos ni modifiques claves correctas históricas sin diseñar una migración de datos.

El banco es finito y artesanal; no genera contenido dinámico. Todos los casos son hipotéticos. La aplicación distingue lógica válida, verdad de premisas y suficiencia de evidencia. No mide inteligencia ni es una herramienta psicométrica validada. La autoevaluación es subjetiva y se muestra por separado. El modo examen oculta soluciones en la interfaz hasta finalizar, pero no es un sistema de supervisión: alguien con herramientas de desarrollo puede inspeccionar código y almacenamiento local. No está diseñado para certificaciones ni múltiples usuarios.

Mejoras priorizadas: ampliar y revisar el banco con docentes (alta utilidad, bajo riesgo); añadir migraciones y seguimiento de familias de problemas (utilidad media); evaluación externa por docente o IA con servidor, consentimiento y rúbricas auditables (mayor complejidad); sincronización opcional cifrada (mayor riesgo de privacidad).

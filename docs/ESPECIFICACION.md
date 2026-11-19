# Criterio: especificación funcional

## Definición y alcance

Aplicación educativa individual en español que permite practicar 12 habilidades de razonamiento y observar resultados independientes. Funciona localmente, sin cuentas, IA, telemetría ni conexión durante el uso de la compilación. React + TypeScript + Vite; datos versionados en localStorage. No es una prueba psicométrica validada ni una certificación de capacidad intelectual.

Obligatorio: diagnóstico por áreas, biblioteca con filtros, tres formatos de respuesta, rúbrica, retroalimentación, correcciones con trazabilidad, transferencia, errores recurrentes, revisión, exámenes nuevos, progreso e importación/exportación. Opcional futuro: banco mayor, evaluación humana/IA mediante servidor, sincronización. No se añaden pagos ni perfiles.

## Pantallas y flujos

- Inicio: métricas reales, continuar sesión, diagnóstico, práctica y examen periódico.
- Biblioteca: filtrar habilidad, dificultad y formato, iniciar ejercicio o transferencia.
- Ejercicio: objetivo, caso hipotético, criterios explícitos, respuesta; cerradas corrigen automáticamente. Abiertas congelan el texto antes de mostrar modelo y solicitan autoevaluación por criterio con motivos.
- Diagnóstico/examen: una respuesta por pregunta, no muestran solución ni acierto hasta finalizar todas. Diagnóstico contiene un ejercicio por área. Examen solo utiliza cerradas nunca contestadas; muestra áreas cubiertas y tamaño disponible.
- Resultados: explicación, solución, errores frecuentes y variante difícil; posibilidad de corregir sin borrar el original; objeción guardada junto al intento, no revisión externa simulada.
- Progreso: métricas por habilidad y separación de preguntas nuevas/conocidas/autoevaluación. Errores agrupados por habilidad e inspeccionables en historial.
- Historial: fecha, puntuación, modo, respuesta y evaluación; exportación JSON recuperable, CSV analítico, importación validada con confirmación de reemplazo y borrado con confirmación.

## Modelo de datos

Exercise: identificador estable, habilidad, familia, dificultad, formato, objetivo, enunciado, opciones/pasos, rúbrica, solución, explicación, errores y variante.
Session: id, modo, ejercicios, inicio, finalización opcional.
Attempt: id, ejercicio, sesión, fecha, respuesta original, nota 0–100, nuevo/conocido, método, rúbrica justificada opcional, correctionOf, objeción opcional.
State: versión 1, sesiones, intentos.

## Reglas

Selección múltiple: 100 o 0; pasos: proporción de pasos correctos. Abiertas: 3 criterios de 0 (ausente), 1 (parcial), 2 (completo), convertidos a porcentaje; motivos mínimos de 10 caracteres y texto mínimo de 30. No hay IA ni análisis semántico automático. Umbral de repaso <70; el último intento decide si permanece pendiente. Correcciones conservan vínculo al original. El diagnóstico inicial es orientativo por su tamaño reducido. Exámenes parciales indican cobertura; agotamiento del banco es un estado explícito. Variantes textuales son propuestas para profundizar; transferencia evaluable usa otro ejercicio del banco sin contestar. Los casos son sintéticos, no evidencia factual externa.

## Seguridad y persistencia

No secretos ni servicios remotos. React escapa texto importado. Copias limitadas a 5 MB, validación de esquema/referencias/puntuaciones/duplicados. No se sobrescriben datos corruptos al iniciar. Errores de cuota/almacenamiento visibles. JSON y CSV contienen respuestas; archivos deben guardarse donde el usuario decida. Borrar datos del navegador o cambiar origen/puerto elimina o aísla acceso: usar siempre el mismo origen y respaldar JSON.

## Plan de pruebas y aceptación

Unidad: consistencia banco, puntuación, rúbrica incompleta, nueva/conocida, selección sin repetición, banco agotado, repaso tras corrección, exportación/importación, duplicados y referencias inválidas, errores de storage y CSV.
Navegador: iniciar diagnóstico y comprobar soluciones ocultas, completar 12 respuestas y ver resultados independientes; ejercicio erróneo/corrección/objeción; respuesta abierta bloqueada y justificada; recargar y continuar; filtros y estados vacíos; exportar/importar/borrar; teclado, etiquetas y diseño móvil sin desborde.
Construcción: TypeScript estricto y Vite producción. La entrega incluye guía de ejecución, dist listo para servir, pruebas y registro de verificación real.

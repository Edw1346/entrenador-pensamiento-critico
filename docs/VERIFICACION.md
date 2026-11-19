# Verificación de Criterio

Fecha de trabajo: 18 de noviembre de 2026 (America/Costa_Rica).

## Resultado
- Compilación TypeScript estricta + Vite: aprobada.
- 21 pruebas unitarias: aprobadas, 0 fallos.
- 9 grupos de comprobaciones de navegador Chromium: aprobados, 0 errores JavaScript.
- Inspección visual real de capturas de escritorio (1440 px) y móvil (390 px): aprobada, sin desbordamiento horizontal en inicio y biblioteca.
- Los perfiles de navegador de prueba son aislados. Las respuestas que aparecen en capturas son datos sintéticos de pruebas, no resultados del usuario.

## Comandos ejecutados
```sh
npm test
npm run build
CHROMIUM_EXECUTABLE=/tmp/perspectiva-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell npm run test:e2e
```
Se utilizó Node 24.19.0 y Chromium instalado en el entorno. La ruta CHROMIUM_EXECUTABLE es específica de este entorno; en otro equipo instalar Chromium mediante `npx playwright install chromium` y ejecutar `npm run test:e2e`.

## Cobertura funcional comprobada
| Requisito | Evidencia |
| --- | --- |
| Diagnóstico por área | Navegador completa las 12 áreas, comprueba 100% y 12 explicaciones finales |
| Biblioteca | Filtros combinados por habilidad, dificultad y formato |
| Tres formatos | Selección errónea/correcta, pasos completos y respuesta abierta |
| Rúbrica | Rechazo de valores fuera de rango, motivos incompletos; nota 50% con tres criterios parciales |
| Explicación y corrección | Respuesta esperada, explicación, reintento enlazado al original |
| Impugnación | Objeción guardada y conservada en respaldo sin alterar puntuación |
| Transferencia | Selección solo de ejercicios nuevos de dificultad >1, con filtro por habilidad |
| Errores y repaso | Último intento decide repaso; corrección suficiente retira ejercicio |
| Exámenes | Selección nueva, agotamiento explícito y resultados ocultos también en historial/progreso |
| Sesión persistente | Salir, recargar y continuar diagnóstico en la siguiente pregunta |
| Progreso | 12 filas de habilidad y estadísticas separadas nueva/conocida/auto |
| Datos | Exportación descargable, JSON corrupto rechazado, borrado confirmado, restauración y recarga |
| Casos límite | Vacíos, máximos, duplicados, referencias rotas, notas manipuladas, almacenamiento bloqueado/cuota |
| CSV | Comillas y fórmulas neutralizadas preservando contenido, incluyendo espacios y controles iniciales |
| Móvil y accesibilidad básica | Etiquetas de controles, foco por teclado y ancho 390 px sin desborde |

## Incidencias encontradas y resueltas
1. CSV perdía el signo inicial al neutralizar fórmulas: corregido y cubierto con dos pruebas de regresión.
2. Los selectores con opciones anidadas no ofrecían un nombre accesible preciso: añadidos nombres explícitos, recorrido completo de navegador aprobado.
3. Historial/progreso podían exponer notas durante un examen en curso: ocultados hasta completar; regresiones unitarias y de navegador aprobadas.
4. El entorno bloqueaba el servidor local: se obtuvo permiso de red y se ejecutó la verificación real. No es un fallo de la app.

## Límites de la verificación
- No se ha realizado auditoría WCAG completa, prueba con lector de pantalla, ni validación en Safari/Firefox o dispositivos físicos.
- No se han probado instalación ni ejecución en un equipo Windows/macOS real. Las instrucciones están incluidas.
- El banco se revisó estructural y aritméticamente; no tiene validación psicométrica ni revisión editorial independiente de un docente humano.
- No hay evaluación semántica automatizada. Las abiertas son autoevaluación explícita, y las objeciones son registros personales.
- La app está verificada localmente. La publicación en GitHub requiere un repositorio accesible; su estado se confirma por separado en la entrega.

## Archivos de evidencia
- `qa/resultados.json`: nueve grupos de comprobaciones ejecutadas.
- `qa/inicio-desktop.png`: pantalla inicial de escritorio.
- `qa/inicio-mobile.png`: pantalla móvil con datos sintéticos.
- `qa/progreso-desktop.png`: panel con doce habilidades.

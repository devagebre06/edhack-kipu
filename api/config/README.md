# Configuración de la evaluación documental

La API usa actualmente `prompts/planificacion-4primaria.v1.md` para valorar unidades y sesiones. La lógica y el cálculo de la nota están en `api/src/services/analysis/evaluation.service.ts` y `rubric.ts`.

`prompts/ficha-monitoreo-ugel06.v1.md` y `rubrics/daily-session.v1.json` son materiales de una etapa anterior y **no participan en la calificación vigente**. Se conservan como referencia histórica; cambiarlos no modifica los resultados de la demo.

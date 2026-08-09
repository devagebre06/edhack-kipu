# Modelos de datos · Kipu

Fuente de verdad del esquema de la base de datos (directriz 1). El **diagrama
`kipu_db.drawio` es la fuente de verdad**; cualquier cambio ahí se propaga a
migraciones, modelos SQL, `api/` y `web/`.

> ⚠️ El **DDL autoritativo y completo** vive en la migración
> [`../migrations/008_remodelado.sql`](../migrations/008_remodelado.sql) (tipos,
> checks, índices, triggers, RLS). Los `.sql` de esta carpeta son el **catálogo
> consolidado legible**; el diagrama es la vista visual. Al cambiar el esquema,
> actualiza los tres.

## Archivos

| Archivo | Contenido |
| --- | --- |
| [`kipu_db.drawio`](kipu_db.drawio) | Diagrama ER completo (fuente de verdad). Ábrelo en [app.diagrams.net](https://app.diagrams.net) o con la extensión *Draw.io Integration* de VS Code |
| [`00_enums.sql`](00_enums.sql) | Tipos `ENUM` |
| [`01_modelo_unificado.sql`](01_modelo_unificado.sql) | Catálogo consolidado del esquema (tablas, columnas, relaciones) |

## Modelo unificado

Kipu usa un **dominio único**: la data real de UGEL 06 puebla estas tablas vía
el **adapter de ingesta**. El **colegio es la institución**. Llaves: `uuid`
surrogado + columna `codigo`/natural `unique` (para casar data externa).

Convención visual del diagrama: **azul** institucional (`ugels`, `canales`,
`colegios`) · **naranja** identidad (`roles`, `usuarios`, `datos_personales`) ·
**verde** académico (`periodos_academicos`, `cursos`, `aulas`, `alumnos`,
`matriculas`) · **amarillo** dictado/contenido (`dictados`, `horarios`,
`unidades`, `sesiones`) · **rojo** evidencia (`evidencias`, `evidencia_versiones`,
`evaluaciones`, `contextos_ia`) · **morado** notas (`escala_logro`, `notas`) ·
**gris** operacional/adapter (`alertas`, `logs_auditoria`, `fuentes_datos`,
`mapeo_llaves_externas`) · **lila** vistas. PK negrita+subrayado, FK cursiva,
`U` = unique (llave natural externa).

### Ejes del diseño

- **Jerarquía institucional real**: `ugels → canales → colegios`; usuarios,
  alumnos, aulas y alertas cuelgan del colegio.
- **Dictado como hub**: `dictados` (aula + curso + profesor + periodo) del que
  cuelgan horarios, unidades y sesiones.
- **Evidencia polimórfica**: `evidencias` se enlaza a una unidad **o** una sesión
  (XOR); un solo pipeline versión + evaluación IA reutilizable.
- **Notas unificadas**: diagnóstico (C1-C4 + GENERAL, escala C/B/A/AD) y notas
  operativas en una sola tabla `notas` vía `escala_logro` + `puntaje_numerico`.
- **Eje temporal**: `periodos_academicos` (año + bimestre + tipo).
- **Adapter de ingesta**: `mapeo_llaves_externas` mapea llave externa → uuid
  interno; un formato nuevo se ingiere solo con su config de mapeo.
- **Data sintética marcada**: flag `es_sintetico` + `fuentes_datos.es_sintetica`
  (no se mutan valores ni llaves).

## Despliegue

Migraciones con `npm run db:migrate -- ../supabase/migrations/00X_*.sql` vía
**Session pooler** de Supabase. Carga de datos: `npm run db:poblacion` (data
UGEL 06 vía adapter) y `npm run db:seed` (roles, escala, periodos, directores,
cuentas Auth, contenido operativo de muestra).

-- =============================================================================
-- Kipu · Modelo de datos unificado — catálogo consolidado (source of truth)
-- =============================================================================
-- DDL AUTORITATIVO Y COMPLETO: supabase/migrations/008_remodelado.sql
-- Diagrama (fuente de verdad, directriz 1): supabase/models/kipu_db.drawio
--
-- Este archivo es el catálogo consolidado y legible del esquema vigente:
-- tablas, columnas clave, relaciones y notas. Para el DDL exacto (tipos, checks,
-- índices, triggers, RLS) ver 008_remodelado.sql.
--
-- Dominio único (unificado): la data real de UGEL 06 puebla estas tablas vía el
-- adapter de ingesta. El colegio ES la institución. Llaves: uuid surrogado + una
-- columna `codigo`/natural `unique` (para casar data externa en el adapter).
-- =============================================================================

-- ── Jerarquía institucional ──────────────────────────────────────────────────
-- ugels(id pk, codigo u=ugel_key, nombre, es_sintetico)
-- canales(id pk, ugel_id→ugels, codigo u=network_key, numero, nombre, distrito, es_sintetico)
-- colegios(id pk, canal_id→canales, codigo u=school_key, codigo_local, nombre,
--          direccion, niveles_educativos text[], latitud, longitud,
--          perfil_desempeno(+label), es_sintetico)

-- ── Identidad y permisos ─────────────────────────────────────────────────────
-- roles(id pk, key u = ugel|director|profesor, nombre)
-- usuarios(id pk→auth.users, rol_id→roles, colegio_id→colegios [null=ugel],
--          nombre_completo, es_sintetico, deleted_at, timestamps)
-- datos_personales(usuario_id pk/fk 1:1 usuarios, dni u [puente al profesor real],
--          telefono, metadata jsonb, timestamps)

-- ── Estructura académica ─────────────────────────────────────────────────────
-- periodos_academicos(id pk, anio, bimestre, tipo=ORDINARIO|DIAGNOSTICO, nombre,
--          fecha_inicio, fecha_fin; unique(anio,bimestre,tipo))
-- cursos(id pk, codigo u=course_key, nombre, es_sintetico)   -- catálogo global
-- aulas(id pk, colegio_id→colegios, codigo u=section_key, grado, seccion, nombre, es_sintetico)
-- alumnos(id pk, colegio_id→colegios, codigo u=student_key, numero, nombre_completo, es_sintetico)
-- matriculas(id pk, alumno_id→alumnos, aula_id→aulas, periodo_id→periodos;
--          unique(alumno_id,aula_id,periodo_id), es_sintetico)  -- time-scoped

-- ── Dictado (hub) y horario ──────────────────────────────────────────────────
-- dictados(id pk, aula_id→aulas, curso_id→cursos, profesor_id→usuarios,
--          periodo_id→periodos; unique(aula,curso,periodo), es_sintetico)
--          [trigger: profesor_id debe tener rol 'profesor']
-- horarios(id pk, dictado_id→dictados, dia_semana, hora_inicio, hora_fin)

-- ── Contenido pedagógico ─────────────────────────────────────────────────────
-- unidades(id pk, dictado_id→dictados, nombre, orden, es_sintetico, timestamps)
-- sesiones(id pk, unidad_id→unidades, nombre, fecha, orden, es_sintetico, timestamps)

-- ── Evidencia → versión → evaluación (polimórfico unidad XOR sesión) ─────────
-- evidencias(id pk, unidad_id→unidades [null], sesion_id→sesiones [null],
--          profesor_id→usuarios, estado evidencia_estado, version_actual,
--          es_sintetico, timestamps; CHECK num_nonnulls(unidad_id,sesion_id)=1)
-- evidencia_versiones(id pk, evidencia_id→evidencias, version, nombre_archivo,
--          storage_path, sha256, markdown, estado, es_valida, motivo_invalidez,
--          created_at; unique(evidencia_id,version))
-- evaluaciones(id pk, version_id→evidencia_versiones, modelo, prompt_version,
--          rubrica_version, decision, puntaje_total, confianza, resumen,
--          fortalezas/mejoras/criterios/flags_criticos jsonb, created_at)
-- contextos_ia(id pk, unidad_id→unidades [null,u], sesion_id→sesiones [null,u],
--          contexto jsonb, created_at; CHECK exactly-one)  -- OCULTO por RLS

-- ── Notas ────────────────────────────────────────────────────────────────────
-- escala_logro(id pk, codigo u = C|B|A|AD, nombre, valor_numerico 1..4)
-- notas(id pk, alumno_id→alumnos, curso_id→cursos, periodo_id→periodos,
--          dictado_id→dictados [null], tipo_evaluacion, competencia [C1..C4|GENERAL],
--          escala_id→escala_logro, puntaje_numerico, descripcion, es_sintetico;
--          unique(alumno,curso,periodo,tipo,competencia))

-- ── Operacional ──────────────────────────────────────────────────────────────
-- alertas(id pk, tipo, severidad, estado, colegio_id→colegios, titulo, resumen,
--          accion_sugerida, evidencia jsonb, historial jsonb, es_sintetico, created_at)
-- logs_auditoria(id pk, actor_id, accion, entidad_tipo, entidad_id, metadata, created_at)

-- ── Adapter de ingesta + procedencia ─────────────────────────────────────────
-- fuentes_datos(id pk, codigo u, nombre, formato, es_sintetica)
-- mapeo_llaves_externas(id pk, fuente_id→fuentes_datos, entidad, llave_externa,
--          id_interno uuid; unique(fuente_id,entidad,llave_externa))

-- ── Vistas (con security_invoker=on: respetan la RLS del que consulta) ───────
-- vw_notas_agregadas          — nota GENERAL por alumno+curso+periodo
-- vw_alumnos_por_profesor     — matriculas ⋈ dictados (alumno↔profesor)
-- vw_mapa_colegio_curso       — buckets de logro por colegio×curso (+lat/long)
-- vw_profesor_resumen         — logro agregado por profesor + contexto colegio

-- ── Enums / RLS / triggers ───────────────────────────────────────────────────
-- Enums: ver 00_enums.sql. RLS habilitado en todas; helpers mi_rol()/mi_colegio().
-- Triggers: assert_rol_profesor (dictados/evidencias), touch_updated_at,
--           log_alerta_cambio (auditoría de estado de alertas).

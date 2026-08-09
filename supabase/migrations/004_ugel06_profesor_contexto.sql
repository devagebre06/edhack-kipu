-- UGEL 06 — Contexto sociodemográfico del profesor.
-- Almacena, por docente, el entorno del colegio donde enseña (red, distrito,
-- código local, dirección, niveles educativos). Es el dataset que alimenta la
-- card demográfica del panel UGEL, junto al resumen de logro de sus secciones.
-- Datos poblados por api/scripts/poblacion.mjs desde:
--   scripts/data/ugel06_profesores_contexto_sociodemografico_30.json
-- El join con el modelo diagnóstico es por dni (ugel06_profesor).

create table ugel06_profesor_contexto (
  dni                text primary key references ugel06_profesor(dni),
  full_name          text not null,
  course_key         text references ugel06_curso(course_key),
  course_name        text,
  ugel_key           text,
  ugel_name          text,
  network_key        text references ugel06_red_educativa(network_key),
  network_number     int,
  network_name       text,
  district           text,
  school_key         text references ugel06_colegio(school_key),
  codigo_local       text,
  school_name        text,
  address            text,
  -- Niveles que atiende el colegio: Cuna / Inicial / Primaria / Secundaria.
  educational_levels text[]
);

create index ugel06_profesor_contexto_school_idx on ugel06_profesor_contexto(school_key);

-- ── Vista resumen: contexto del profesor + agregado de logro de sus secciones ─
-- Grano: un profesor. Cruza sus secciones y evaluaciones diagnósticas para
-- contar estudiantes por bucket de color (crítico C / intermedio B / logrado A,AD)
-- y su promedio 1..4. El left join con contexto mantiene al profesor aunque aún
-- no tenga fila sociodemográfica cargada.
create view ugel06_profesor_resumen as
select
  p.dni,
  p.full_name,
  p.course_key,
  co.course_name,
  ctx.school_key,
  ctx.school_name,
  ctx.codigo_local,
  ctx.address,
  ctx.district,
  ctx.network_key,
  ctx.network_name,
  ctx.educational_levels,
  count(e.*)                                             as total,
  count(*) filter (where e.overall_grade = 'C')         as critico,
  count(*) filter (where e.overall_grade = 'B')         as intermedio,
  count(*) filter (where e.overall_grade in ('A','AD')) as logrado,
  round(avg(e.average_score_1_to_4)::numeric, 2)        as promedio
from ugel06_profesor p
join ugel06_curso co                 on co.course_key = p.course_key
join ugel06_seccion s                on s.professor_dni = p.dni
join ugel06_evaluacion_diagnostica e on e.section_key = s.section_key
left join ugel06_profesor_contexto ctx on ctx.dni = p.dni
group by
  p.dni, p.full_name, p.course_key, co.course_name,
  ctx.school_key, ctx.school_name, ctx.codigo_local, ctx.address,
  ctx.district, ctx.network_key, ctx.network_name, ctx.educational_levels;

-- ── RLS: lectura para usuarios autenticados (agregado no sensible) ────────────
alter table ugel06_profesor_contexto enable row level security;

create policy ugel06_profesor_contexto_read
  on ugel06_profesor_contexto for select to authenticated using (true);

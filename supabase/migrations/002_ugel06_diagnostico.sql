-- UGEL 06 — Modelo de evaluación diagnóstica (rúbricas + evaluaciones).
-- Sigue el diagrama: UGEL → RED_EDUCATIVA → COLEGIO → PROFESOR → SECCION → EVALUACION_DIAGNOSTICA,
-- con CURSO y ESCALA_LOGRO como catálogos. Prefijo ugel06_ para no colisionar con el esquema Kipu.
-- Datos poblados por api/scripts/poblacion.mjs desde los JSON sintéticos.

-- ── Catálogos ───────────────────────────────────────────────────────────────
create table ugel06_ugel (
  ugel_key  text primary key,
  ugel_name text not null
);

-- Escala de logro: C / B / A / AD con su valor numérico (C=1 … AD=4).
create table ugel06_escala_logro (
  grade_code    text primary key,       -- C, B, A, AD
  level_name    text not null,          -- "En inicio", "En proceso", …
  score_numeric int  not null           -- 1..4
);

create table ugel06_curso (
  course_key  text primary key,         -- matematica, comunicacion
  course_name text not null
);

-- ── Estructura educativa ─────────────────────────────────────────────────────
create table ugel06_red_educativa (
  network_key    text primary key,
  ugel_key       text not null references ugel06_ugel(ugel_key),
  network_number int,
  network_name   text not null,
  district       text
);

create table ugel06_colegio (
  school_key        text primary key,
  network_key       text not null references ugel06_red_educativa(network_key),
  codigo_local      text,
  school_name       text not null,
  address           text,
  educational_levels text,
  -- Coordenadas para el mapa. Nullable: hoy se rellenan con el centroide del
  -- distrito (ver poblacion.mjs); reemplazar por coords oficiales cuando existan.
  latitude          double precision,
  longitude         double precision
);

create table ugel06_profesor (
  dni         text primary key,
  full_name   text not null,
  school_key  text references ugel06_colegio(school_key),
  course_key  text references ugel06_curso(course_key),
  network_key text references ugel06_red_educativa(network_key)
);

create table ugel06_seccion (
  section_key                    text primary key,
  professor_dni                  text references ugel06_profesor(dni),
  school_key                     text not null references ugel06_colegio(school_key),
  course_key                     text references ugel06_curso(course_key),
  section_code                   text,                -- A / B
  school_performance_profile     text,                -- buen_desempeno / intermedio / critico
  school_performance_profile_label text
);

create table ugel06_evaluacion_diagnostica (
  evaluation_key      text primary key,
  section_key         text not null references ugel06_seccion(section_key),
  student_key         text not null,
  student_number      int,
  student_name        text,
  c1 text references ugel06_escala_logro(grade_code),
  c2 text references ugel06_escala_logro(grade_code),
  c3 text references ugel06_escala_logro(grade_code),
  c4 text references ugel06_escala_logro(grade_code),
  overall_grade       text references ugel06_escala_logro(grade_code),
  overall_level       text,
  average_score_1_to_4 numeric
);

create index ugel06_seccion_school_idx on ugel06_seccion(school_key);
create index ugel06_eval_section_idx on ugel06_evaluacion_diagnostica(section_key);
create index ugel06_eval_grade_idx on ugel06_evaluacion_diagnostica(overall_grade);

-- ── Vista de agregado para el mapa ───────────────────────────────────────────
-- Grano colegio × curso: cuenta estudiantes por bucket de color.
--   C           → crítico     (#D32F2F)
--   B           → intermedio  (#FBC02D)
--   A, AD       → logrado     (#43A047)
create view ugel06_mapa_colegio_curso as
select
  c.school_key,
  c.school_name,
  c.latitude,
  c.longitude,
  r.network_key,
  r.network_name,
  r.district,
  s.course_key,
  co.course_name,
  count(e.*)                                                as total,
  count(*) filter (where e.overall_grade = 'C')            as critico,
  count(*) filter (where e.overall_grade = 'B')            as intermedio,
  count(*) filter (where e.overall_grade in ('A', 'AD'))   as logrado,
  round(avg(e.average_score_1_to_4)::numeric, 2)           as promedio
from ugel06_colegio c
join ugel06_red_educativa r on r.network_key = c.network_key
join ugel06_seccion s       on s.school_key = c.school_key
join ugel06_curso co        on co.course_key = s.course_key
join ugel06_evaluacion_diagnostica e on e.section_key = s.section_key
group by c.school_key, c.school_name, c.latitude, c.longitude,
         r.network_key, r.network_name, r.district, s.course_key, co.course_name;

-- ── RLS: lectura para usuarios autenticados (agregado no sensible) ────────────
alter table ugel06_ugel                  enable row level security;
alter table ugel06_escala_logro          enable row level security;
alter table ugel06_curso                 enable row level security;
alter table ugel06_red_educativa         enable row level security;
alter table ugel06_colegio               enable row level security;
alter table ugel06_profesor              enable row level security;
alter table ugel06_seccion               enable row level security;
alter table ugel06_evaluacion_diagnostica enable row level security;

create policy ugel06_ugel_read      on ugel06_ugel                  for select to authenticated using (true);
create policy ugel06_escala_read    on ugel06_escala_logro          for select to authenticated using (true);
create policy ugel06_curso_read     on ugel06_curso                 for select to authenticated using (true);
create policy ugel06_red_read       on ugel06_red_educativa         for select to authenticated using (true);
create policy ugel06_colegio_read   on ugel06_colegio               for select to authenticated using (true);
create policy ugel06_profesor_read  on ugel06_profesor              for select to authenticated using (true);
create policy ugel06_seccion_read   on ugel06_seccion               for select to authenticated using (true);
create policy ugel06_eval_read      on ugel06_evaluacion_diagnostica for select to authenticated using (true);

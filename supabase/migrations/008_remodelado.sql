-- =============================================================================
-- Kipu · 008 — Remodelado a modelo unificado (greenfield sobre data sintética)
-- =============================================================================
-- Reemplaza el esquema previo (core Kipu + ugel06_*) por un modelo unificado:
--   jerarquía institucional real (ugels → canales → colegios), identidad con
--   roles, eje temporal (periodos_academicos), dictado como hub, evidencia
--   polimórfica, notas con escala de logro, adapter de ingesta y marcado de
--   data sintética (es_sintetico).
--
-- Fuente de verdad del modelo: supabase/models/kipu_db.drawio (directriz 1).
-- DESTRUCTIVO: descarta el esquema sintético anterior. Aplicar con:
--   npm run db:migrate -- ../supabase/migrations/008_remodelado.sql
-- =============================================================================

begin;

-- ── 0. Teardown del esquema anterior ─────────────────────────────────────────
drop view if exists ugel06_mapa_colegio_curso            cascade;
drop view if exists ugel06_profesor_resumen              cascade;
drop table if exists artifact_contexts                   cascade;
drop table if exists unit_groups                          cascade;
drop table if exists evaluations                          cascade;
drop table if exists artifact_versions                    cascade;
drop table if exists artifacts                            cascade;
drop table if exists grade_records                        cascade;
drop table if exists class_schedules                      cascade;
drop table if exists alerts                               cascade;
drop table if exists audit_logs                           cascade;
drop table if exists student_groups                       cascade;
drop table if exists subjects                             cascade;
drop table if exists profiles                             cascade;
drop table if exists institutions                         cascade;
drop table if exists ugel06_evaluacion_diagnostica        cascade;
drop table if exists ugel06_profesor_contexto             cascade;
drop table if exists ugel06_seccion                       cascade;
drop table if exists ugel06_profesor                      cascade;
drop table if exists ugel06_colegio                       cascade;
drop table if exists ugel06_red_educativa                 cascade;
drop table if exists ugel06_curso                         cascade;
drop table if exists ugel06_escala_logro                  cascade;
drop table if exists ugel06_ugel                          cascade;

drop function if exists my_role()          cascade;
drop function if exists my_institution()   cascade;
drop function if exists log_alert_change() cascade;

drop type if exists user_role       cascade;
drop type if exists artifact_type   cascade;
drop type if exists artifact_status cascade;
drop type if exists alert_severity  cascade;
drop type if exists alert_status    cascade;

-- ── 1. Extensiones ───────────────────────────────────────────────────────────
create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ── 2. Enums ─────────────────────────────────────────────────────────────────
-- Valores en inglés (se conservan tokens usados por la UI actual).
create type evidencia_estado as enum
  ('PROCESSING','APPROVED','NEEDS_REVISION','MANUAL_REVIEW','PROCESSING_ERROR');
create type alert_severity as enum ('LOW','MEDIUM','HIGH','CRITICAL');
create type alert_status   as enum ('NEW','UNDER_REVIEW','DISMISSED','ESCALATED','RESOLVED');

-- =============================================================================
-- 3. Adapter de ingesta + procedencia
-- =============================================================================
create table fuentes_datos (
  id           uuid primary key default gen_random_uuid(),
  codigo       text unique not null,          -- p.ej. 'ugel06_synthetic_v1'
  nombre       text not null,
  formato      text,                           -- json_rubricas | json_evaluaciones | seed | ...
  es_sintetica boolean not null default false,
  created_at   timestamptz not null default now()
);

create table mapeo_llaves_externas (
  id            uuid primary key default gen_random_uuid(),
  fuente_id     uuid not null references fuentes_datos(id) on delete cascade,
  entidad       text not null,                 -- ugel|canal|colegio|curso|profesor|aula|alumno|...
  llave_externa text not null,                 -- school_key, dni, student_key, ...
  id_interno    uuid not null,                 -- uuid de la fila creada en la tabla destino
  created_at    timestamptz not null default now(),
  unique (fuente_id, entidad, llave_externa)
);
create index mapeo_llaves_entidad_idx on mapeo_llaves_externas(entidad, llave_externa);

-- =============================================================================
-- 4. Jerarquía institucional
-- =============================================================================
create table ugels (
  id           uuid primary key default gen_random_uuid(),
  codigo       text unique not null,           -- ugel_key
  nombre       text not null,
  es_sintetico boolean not null default false
);

create table canales (              -- red educativa
  id           uuid primary key default gen_random_uuid(),
  ugel_id      uuid not null references ugels(id) on delete cascade,
  codigo       text unique not null,           -- network_key
  numero       int,
  nombre       text not null,
  distrito     text,
  es_sintetico boolean not null default false
);
create index canales_ugel_idx on canales(ugel_id);

create table colegios (
  id                     uuid primary key default gen_random_uuid(),
  canal_id               uuid not null references canales(id) on delete cascade,
  codigo                 text unique not null, -- school_key
  codigo_local           text,                 -- código MINEDU
  nombre                 text not null,
  direccion              text,
  niveles_educativos     text[],
  latitud                double precision,
  longitud               double precision,
  perfil_desempeno       text,                 -- buen_desempeno | intermedio | critico
  perfil_desempeno_label text,
  es_sintetico           boolean not null default false
);
create index colegios_canal_idx on colegios(canal_id);

-- =============================================================================
-- 5. Identidad y permisos
-- =============================================================================
create table roles (
  id     uuid primary key default gen_random_uuid(),
  key    text unique not null,                 -- ugel | director | profesor
  nombre text not null
);

create table usuarios (
  id             uuid primary key references auth.users(id) on delete cascade,
  rol_id         uuid not null references roles(id),
  colegio_id     uuid references colegios(id),  -- null para rol ugel
  nombre_completo text not null,
  es_sintetico   boolean not null default false,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index usuarios_rol_idx        on usuarios(rol_id);
create index usuarios_colegio_idx    on usuarios(colegio_id);
create index usuarios_deleted_at_idx on usuarios(deleted_at);

create table datos_personales (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  dni        text unique,                       -- puente al profesor real
  telefono   text,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index datos_personales_dni_idx on datos_personales(dni);

-- =============================================================================
-- 6. Estructura académica
-- =============================================================================
create table periodos_academicos (
  id           uuid primary key default gen_random_uuid(),
  anio         int not null,
  bimestre     int,                             -- null para tipo DIAGNOSTICO
  tipo         text not null default 'ORDINARIO', -- ORDINARIO | DIAGNOSTICO
  nombre       text not null,
  fecha_inicio date,
  fecha_fin    date,
  unique (anio, bimestre, tipo)
);

create table cursos (
  id           uuid primary key default gen_random_uuid(),
  codigo       text unique not null,            -- course_key
  nombre       text not null,
  es_sintetico boolean not null default false
);

create table aulas (
  id           uuid primary key default gen_random_uuid(),
  colegio_id   uuid not null references colegios(id) on delete cascade,
  codigo       text unique,                     -- section_key
  grado        text,                            -- null: la data solo trae sección A/B
  seccion      text,                            -- A / B
  nombre       text,
  es_sintetico boolean not null default false
);
create index aulas_colegio_idx on aulas(colegio_id);

create table alumnos (
  id             uuid primary key default gen_random_uuid(),
  colegio_id     uuid not null references colegios(id) on delete cascade,
  codigo         text unique,                   -- student_key
  numero         int,
  nombre_completo text not null,
  es_sintetico   boolean not null default false
);
create index alumnos_colegio_idx on alumnos(colegio_id);

create table matriculas (
  id         uuid primary key default gen_random_uuid(),
  alumno_id  uuid not null references alumnos(id) on delete cascade,
  aula_id    uuid not null references aulas(id) on delete cascade,
  periodo_id uuid not null references periodos_academicos(id),
  es_sintetico boolean not null default false,
  unique (alumno_id, aula_id, periodo_id)
);
create index matriculas_aula_idx    on matriculas(aula_id);
create index matriculas_periodo_idx on matriculas(periodo_id);

-- =============================================================================
-- 7. Dictado (hub) y horario
-- =============================================================================
create table dictados (
  id           uuid primary key default gen_random_uuid(),
  aula_id      uuid not null references aulas(id) on delete cascade,
  curso_id     uuid not null references cursos(id),
  profesor_id  uuid not null references usuarios(id),
  periodo_id   uuid not null references periodos_academicos(id),
  es_sintetico boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (aula_id, curso_id, periodo_id)
);
create index dictados_curso_idx    on dictados(curso_id);
create index dictados_profesor_idx on dictados(profesor_id);
create index dictados_periodo_idx  on dictados(periodo_id);

create table horarios (
  id          uuid primary key default gen_random_uuid(),
  dictado_id  uuid not null references dictados(id) on delete cascade,
  dia_semana  int not null,                     -- 0=domingo
  hora_inicio time not null,
  hora_fin    time not null
);
create index horarios_dictado_idx on horarios(dictado_id);

-- =============================================================================
-- 8. Contenido pedagógico
-- =============================================================================
create table unidades (
  id           uuid primary key default gen_random_uuid(),
  dictado_id   uuid not null references dictados(id) on delete cascade,
  nombre       text not null,
  orden        int,
  es_sintetico boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index unidades_dictado_idx on unidades(dictado_id);

create table sesiones (
  id           uuid primary key default gen_random_uuid(),
  unidad_id    uuid not null references unidades(id) on delete cascade,
  nombre       text not null,
  fecha        date,
  orden        int,
  es_sintetico boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index sesiones_unidad_idx on sesiones(unidad_id);

-- =============================================================================
-- 9. Evidencia → versión → evaluación (polimórfico unidad XOR sesión)
-- =============================================================================
create table evidencias (
  id             uuid primary key default gen_random_uuid(),
  unidad_id      uuid references unidades(id) on delete cascade,
  sesion_id      uuid references sesiones(id) on delete cascade,
  profesor_id    uuid not null references usuarios(id),
  estado         evidencia_estado not null default 'PROCESSING',
  version_actual int not null default 1,
  es_sintetico   boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint evidencias_sujeto_chk check (num_nonnulls(unidad_id, sesion_id) = 1)
);
create index evidencias_unidad_idx   on evidencias(unidad_id);
create index evidencias_sesion_idx   on evidencias(sesion_id);
create index evidencias_profesor_idx on evidencias(profesor_id);

create table evidencia_versiones (
  id             uuid primary key default gen_random_uuid(),
  evidencia_id   uuid not null references evidencias(id) on delete cascade,
  version        int not null,
  nombre_archivo text not null,
  storage_path   text not null,
  sha256         text not null,
  markdown       text,
  estado         evidencia_estado not null default 'PROCESSING',
  es_valida      boolean not null default false,
  motivo_invalidez text,
  created_at     timestamptz not null default now(),
  unique (evidencia_id, version)
);
create index evidencia_versiones_evidencia_idx on evidencia_versiones(evidencia_id);

create table evaluaciones (
  id             uuid primary key default gen_random_uuid(),
  version_id     uuid not null references evidencia_versiones(id) on delete cascade,
  modelo         text not null,
  prompt_version text not null default 'v1',
  rubrica_version text not null default 'daily-session.v1',
  decision       evidencia_estado not null,
  puntaje_total  int not null,
  confianza      numeric not null,
  resumen        text not null,
  fortalezas     jsonb not null default '[]',
  mejoras        jsonb not null default '[]',
  criterios      jsonb not null default '[]',
  flags_criticos jsonb not null default '[]',
  created_at     timestamptz not null default now()
);
create index evaluaciones_version_idx on evaluaciones(version_id);

-- Contexto IA de contenido: 1:1 con unidad O con sesión. Oculto por RLS.
create table contextos_ia (
  id         uuid primary key default gen_random_uuid(),
  unidad_id  uuid unique references unidades(id) on delete cascade,
  sesion_id  uuid unique references sesiones(id) on delete cascade,
  contexto   jsonb not null,
  created_at timestamptz not null default now(),
  constraint contextos_ia_sujeto_chk check (num_nonnulls(unidad_id, sesion_id) = 1)
);

-- =============================================================================
-- 10. Notas + escala de logro
-- =============================================================================
create table escala_logro (
  id             uuid primary key default gen_random_uuid(),
  codigo         text unique not null,          -- C | B | A | AD
  nombre         text not null,                 -- En inicio | En proceso | ...
  valor_numerico int not null                   -- 1..4
);

create table notas (
  id               uuid primary key default gen_random_uuid(),
  alumno_id        uuid not null references alumnos(id) on delete cascade,
  curso_id         uuid not null references cursos(id),
  periodo_id       uuid not null references periodos_academicos(id),
  dictado_id       uuid references dictados(id) on delete set null,
  tipo_evaluacion  text not null default 'DIAGNOSTICO',
  competencia      text,                         -- null | C1..C4 | GENERAL
  escala_id        uuid references escala_logro(id),  -- nivel cualitativo
  puntaje_numerico numeric,                       -- promedio / nota numérica
  descripcion      text,
  es_sintetico     boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (alumno_id, curso_id, periodo_id, tipo_evaluacion, competencia)
);
create index notas_alumno_idx  on notas(alumno_id);
create index notas_curso_idx   on notas(curso_id);
create index notas_periodo_idx on notas(periodo_id);

-- =============================================================================
-- 11. Operacional
-- =============================================================================
create table alertas (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null,
  severidad        alert_severity not null,
  estado           alert_status not null default 'NEW',
  colegio_id       uuid references colegios(id),
  titulo           text not null,
  resumen          text not null,
  accion_sugerida  text not null,
  evidencia        jsonb not null default '{}',
  historial        jsonb not null default '[]',
  es_sintetico     boolean not null default false,
  created_at       timestamptz not null default now()
);
create index alertas_colegio_idx on alertas(colegio_id);

create table logs_auditoria (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,
  accion      text not null,
  entidad_tipo text,
  entidad_id  uuid,
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- 12. Funciones y triggers
-- =============================================================================
-- Helpers RLS
create function mi_rol() returns text language sql stable security definer as $$
  select r.key from usuarios u join roles r on r.id = u.rol_id where u.id = auth.uid()
$$;
create function mi_colegio() returns uuid language sql stable security definer as $$
  select colegio_id from usuarios where id = auth.uid()
$$;

-- updated_at automático
create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger usuarios_touch  before update on usuarios  for each row execute function touch_updated_at();
create trigger evidencias_touch before update on evidencias for each row execute function touch_updated_at();
create trigger unidades_touch  before update on unidades  for each row execute function touch_updated_at();
create trigger sesiones_touch  before update on sesiones  for each row execute function touch_updated_at();
create trigger datos_personales_touch before update on datos_personales for each row execute function touch_updated_at();

-- El profesor de un dictado / evidencia debe tener rol 'profesor'
create function assert_rol_profesor() returns trigger language plpgsql as $$
begin
  if (select r.key from usuarios u join roles r on r.id = u.rol_id where u.id = new.profesor_id) <> 'profesor' then
    raise exception 'profesor_id % no tiene rol profesor', new.profesor_id;
  end if;
  return new;
end $$;
create trigger dictados_profesor_chk   before insert or update on dictados   for each row execute function assert_rol_profesor();
create trigger evidencias_profesor_chk before insert or update on evidencias for each row execute function assert_rol_profesor();

-- Auditoría de cambios de estado en alertas
create function log_alerta_cambio() returns trigger language plpgsql security definer as $$
begin
  insert into logs_auditoria(actor_id, accion, entidad_tipo, entidad_id, metadata)
  values (auth.uid(), 'ALERT_STATUS_CHANGE', 'alerta', new.id,
          jsonb_build_object('from', old.estado, 'to', new.estado));
  return new;
end $$;
create trigger alertas_audit after update on alertas for each row execute function log_alerta_cambio();

-- =============================================================================
-- 13. Vistas
-- =============================================================================
-- Nota general (GENERAL) de cada alumno por curso/periodo.
create view vw_notas_agregadas with (security_invoker = on) as
select n.alumno_id, n.curso_id, n.periodo_id,
       n.escala_id, e.codigo as nivel, e.nombre as nivel_nombre,
       n.puntaje_numerico as promedio
from notas n
left join escala_logro e on e.id = n.escala_id
where n.competencia = 'GENERAL';

-- Alumnos por profesor (matrícula ⋈ dictado, mismo aula+periodo).
create view vw_alumnos_por_profesor with (security_invoker = on) as
select distinct d.profesor_id, m.alumno_id, m.aula_id, m.periodo_id
from dictados d
join matriculas m on m.aula_id = d.aula_id and m.periodo_id = d.periodo_id;

-- Mapa colegio × curso: buckets de logro desde la nota GENERAL diagnóstica.
create view vw_mapa_colegio_curso with (security_invoker = on) as
select
  c.id as colegio_id, c.codigo as school_key, c.nombre as school_name,
  c.latitud, c.longitud, ca.codigo as network_key, ca.nombre as network_name,
  ca.distrito as district, cu.id as curso_id, cu.codigo as course_key, cu.nombre as course_name,
  count(n.*)                                             as total,
  count(*) filter (where el.codigo = 'C')               as critico,
  count(*) filter (where el.codigo = 'B')               as intermedio,
  count(*) filter (where el.codigo in ('A','AD'))       as logrado,
  round(avg(n.puntaje_numerico)::numeric, 2)            as promedio
from colegios c
join canales ca on ca.id = c.canal_id
join alumnos a  on a.colegio_id = c.id
join notas n    on n.alumno_id = a.id and n.competencia = 'GENERAL' and n.tipo_evaluacion = 'DIAGNOSTICO'
join cursos cu  on cu.id = n.curso_id
left join escala_logro el on el.id = n.escala_id
group by c.id, c.codigo, c.nombre, c.latitud, c.longitud,
         ca.codigo, ca.nombre, ca.distrito, cu.id, cu.codigo, cu.nombre;

-- Resumen por profesor: logro agregado de sus alumnos + contexto del colegio.
create view vw_profesor_resumen with (security_invoker = on) as
select
  u.id as profesor_id, dp.dni, u.nombre_completo as full_name,
  cu.id as curso_id, cu.codigo as course_key, cu.nombre as course_name,
  c.codigo as school_key, c.nombre as school_name, c.codigo_local, c.direccion as address,
  ca.distrito as district, ca.codigo as network_key, ca.nombre as network_name,
  c.niveles_educativos as educational_levels,
  count(n.*)                                       as total,
  count(*) filter (where el.codigo = 'C')          as critico,
  count(*) filter (where el.codigo = 'B')          as intermedio,
  count(*) filter (where el.codigo in ('A','AD'))  as logrado,
  round(avg(n.puntaje_numerico)::numeric, 2)       as promedio
from usuarios u
join roles r          on r.id = u.rol_id and r.key = 'profesor'
left join datos_personales dp on dp.usuario_id = u.id
join dictados d       on d.profesor_id = u.id
join cursos cu        on cu.id = d.curso_id
join colegios c       on c.id = u.colegio_id
join canales ca       on ca.id = c.canal_id
join matriculas m     on m.aula_id = d.aula_id and m.periodo_id = d.periodo_id
join notas n          on n.alumno_id = m.alumno_id and n.curso_id = cu.id
                       and n.competencia = 'GENERAL' and n.tipo_evaluacion = 'DIAGNOSTICO'
left join escala_logro el on el.id = n.escala_id
group by u.id, dp.dni, u.nombre_completo, cu.id, cu.codigo, cu.nombre,
         c.codigo, c.nombre, c.codigo_local, c.direccion, ca.distrito,
         ca.codigo, ca.nombre, c.niveles_educativos;

-- =============================================================================
-- 14. Row Level Security
-- =============================================================================
alter table ugels                 enable row level security;
alter table canales               enable row level security;
alter table colegios              enable row level security;
alter table roles                 enable row level security;
alter table usuarios              enable row level security;
alter table datos_personales      enable row level security;
alter table periodos_academicos   enable row level security;
alter table cursos                enable row level security;
alter table aulas                 enable row level security;
alter table alumnos               enable row level security;
alter table matriculas            enable row level security;
alter table dictados              enable row level security;
alter table horarios              enable row level security;
alter table unidades              enable row level security;
alter table sesiones              enable row level security;
alter table evidencias            enable row level security;
alter table evidencia_versiones   enable row level security;
alter table evaluaciones          enable row level security;
alter table contextos_ia          enable row level security;
alter table escala_logro          enable row level security;
alter table notas                 enable row level security;
alter table alertas               enable row level security;
alter table logs_auditoria        enable row level security;  -- sin policies: solo service role
alter table fuentes_datos         enable row level security;  -- solo service role
alter table mapeo_llaves_externas enable row level security;  -- solo service role

-- Catálogos: lectura para autenticados.
create policy roles_read     on roles               for select to authenticated using (true);
create policy periodos_read  on periodos_academicos for select to authenticated using (true);
create policy cursos_read    on cursos              for select to authenticated using (true);
create policy escala_read    on escala_logro        for select to authenticated using (true);
create policy ugels_read     on ugels               for select to authenticated using (true);
create policy canales_read   on canales             for select to authenticated using (true);
create policy colegios_read  on colegios            for select to authenticated using (true);

-- Usuarios: uno mismo · ugel (todo) · director (su colegio).
create policy usuarios_read on usuarios for select to authenticated
  using (id = auth.uid() or mi_rol() = 'ugel'
    or (mi_rol() = 'director' and colegio_id = mi_colegio()));
create policy datos_personales_read on datos_personales for select to authenticated
  using (usuario_id = auth.uid() or mi_rol() = 'ugel'
    or (mi_rol() = 'director' and exists (
      select 1 from usuarios u where u.id = datos_personales.usuario_id and u.colegio_id = mi_colegio())));

-- Aulas / alumnos / matrículas: ugel · director de su colegio · profesor con dictado.
create policy aulas_read on aulas for select to authenticated
  using (mi_rol() = 'ugel' or colegio_id = mi_colegio());
create policy alumnos_read on alumnos for select to authenticated
  using (mi_rol() = 'ugel' or colegio_id = mi_colegio());
create policy matriculas_read on matriculas for select to authenticated
  using (mi_rol() = 'ugel' or exists (
    select 1 from aulas a where a.id = matriculas.aula_id and a.colegio_id = mi_colegio()));

-- Dictados / horarios: profesor dueño · ugel · director de su colegio.
create policy dictados_read on dictados for select to authenticated
  using (profesor_id = auth.uid() or mi_rol() = 'ugel' or exists (
    select 1 from aulas a where a.id = dictados.aula_id and a.colegio_id = mi_colegio()));
create policy horarios_read on horarios for select to authenticated
  using (exists (select 1 from dictados d where d.id = horarios.dictado_id
    and (d.profesor_id = auth.uid() or mi_rol() = 'ugel'
      or exists (select 1 from aulas a where a.id = d.aula_id and a.colegio_id = mi_colegio()))));

-- Unidades / sesiones: profesor del dictado · ugel · director del colegio.
create policy unidades_read on unidades for select to authenticated
  using (exists (select 1 from dictados d join aulas a on a.id = d.aula_id
    where d.id = unidades.dictado_id
      and (d.profesor_id = auth.uid() or mi_rol() = 'ugel' or a.colegio_id = mi_colegio())));
create policy sesiones_read on sesiones for select to authenticated
  using (exists (select 1 from unidades un join dictados d on d.id = un.dictado_id join aulas a on a.id = d.aula_id
    where un.id = sesiones.unidad_id
      and (d.profesor_id = auth.uid() or mi_rol() = 'ugel' or a.colegio_id = mi_colegio())));

-- Evidencias / versiones / evaluaciones: profesor dueño · ugel · director del colegio.
create policy evidencias_read on evidencias for select to authenticated
  using (profesor_id = auth.uid() or mi_rol() = 'ugel' or exists (
    select 1 from usuarios u where u.id = evidencias.profesor_id and u.colegio_id = mi_colegio()));
create policy evidencia_versiones_read on evidencia_versiones for select to authenticated
  using (exists (select 1 from evidencias e where e.id = evidencia_versiones.evidencia_id
    and (e.profesor_id = auth.uid() or mi_rol() = 'ugel'
      or exists (select 1 from usuarios u where u.id = e.profesor_id and u.colegio_id = mi_colegio()))));
create policy evaluaciones_read on evaluaciones for select to authenticated
  using (exists (select 1 from evidencia_versiones v join evidencias e on e.id = v.evidencia_id
    where v.id = evaluaciones.version_id
      and (e.profesor_id = auth.uid() or mi_rol() = 'ugel'
        or exists (select 1 from usuarios u where u.id = e.profesor_id and u.colegio_id = mi_colegio()))));

-- Contexto IA: el docente dueño NO lo lee; sí ugel y director del colegio.
create policy contextos_ia_read on contextos_ia for select to authenticated
  using (mi_rol() = 'ugel' or (mi_rol() = 'director' and exists (
    select 1 from unidades un join dictados d on d.id = un.dictado_id join aulas a on a.id = d.aula_id
    where un.id = contextos_ia.unidad_id and a.colegio_id = mi_colegio()
    union
    select 1 from sesiones s join unidades un on un.id = s.unidad_id
      join dictados d on d.id = un.dictado_id join aulas a on a.id = d.aula_id
    where s.id = contextos_ia.sesion_id and a.colegio_id = mi_colegio())));

-- Notas: ugel · director de su colegio · profesor con dictado del curso.
create policy notas_read on notas for select to authenticated
  using (mi_rol() = 'ugel' or exists (
    select 1 from alumnos a where a.id = notas.alumno_id and a.colegio_id = mi_colegio()));

-- Alertas: ugel · director de su colegio (lectura y update).
create policy alertas_read on alertas for select to authenticated
  using (mi_rol() = 'ugel' or (mi_rol() = 'director' and colegio_id = mi_colegio()));
create policy alertas_update on alertas for update to authenticated
  using (mi_rol() = 'ugel' or (mi_rol() = 'director' and colegio_id = mi_colegio()));

commit;

-- =============================================================================
-- Kipu · 015 — `competencias_dictado`: el trabajo del docente sobre cada competencia
-- =============================================================================
-- Las competencias son del CNEB: no se inventan ni se editan. Lo que sí es del
-- docente es CÓMO las está trabajando en su aula — cuál tiene en foco este
-- bimestre, cuál está reforzando, cuál da por consolidada — y el plan que se
-- propone para cada una.
--
-- Eso es lo que guarda esta tabla: una fila por dictado × competencia. El
-- desempeño (promedios, distribución) NO se guarda aquí: se calcula desde
-- `notas`, que sigue siendo la única fuente de verdad de las calificaciones.
-- =============================================================================

begin;

create table if not exists competencias_dictado (
  id           uuid primary key default gen_random_uuid(),
  dictado_id   uuid not null references dictados(id) on delete cascade,
  competencia  text not null,                       -- C1 … C4 (según el área)
  estado       text not null default 'PENDIENTE',
  -- Plan del docente para esa competencia: qué va a hacer y con qué evidencia.
  nota         text,
  updated_at   timestamptz not null default now(),
  unique (dictado_id, competencia),
  constraint competencias_dictado_estado_chk
    check (estado in ('PENDIENTE', 'FOCO', 'REFORZANDO', 'CONSOLIDADA'))
);
create index if not exists competencias_dictado_dictado_idx on competencias_dictado(dictado_id);

comment on table competencias_dictado is
  'Seguimiento que hace el docente de cada competencia del CNEB en un dictado (estado de trabajo + plan).';

alter table competencias_dictado enable row level security;

-- Lectura: el docente del dictado, el director de ese colegio y la UGEL.
drop policy if exists competencias_dictado_read on competencias_dictado;
create policy competencias_dictado_read on competencias_dictado for select to authenticated
  using (exists (
    select 1 from dictados d join aulas a on a.id = d.aula_id
    where d.id = competencias_dictado.dictado_id
      and (d.profesor_id = auth.uid() or mi_rol() = 'ugel' or a.colegio_id = mi_colegio())));

-- La escritura va por la API con service_role, como el resto de escrituras.

create or replace function touch_competencias_dictado() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists competencias_dictado_touch on competencias_dictado;
create trigger competencias_dictado_touch before update on competencias_dictado
  for each row execute function touch_competencias_dictado();

commit;

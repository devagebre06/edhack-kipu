-- =============================================================================
-- Kipu · 010 — `aulas`: turno y nivel educativo
-- =============================================================================
-- La plantilla real de evaluación diagnóstica que usa la UGEL 06
-- (docs/privado/EV. DIAGNÓSTICA PRIMARIA.xlsx) identifica al aula por
-- Grado (1°-6°) + Sección (A-F) + **Turno** (Mañana/Tarde), y el acta declara el
-- nivel educativo (Primaria). El modelo solo guardaba grado/sección, así que el
-- turno se perdía y dos secciones homónimas de distinto turno eran
-- indistinguibles en el panel de horarios.
--
-- Cambio mecánico y de bajo riesgo (directriz 1): dos columnas nullable, sin
-- reescritura de datos ni impacto en RLS, FKs o contratos existentes.
-- =============================================================================

begin;

alter table aulas add column if not exists turno text;
alter table aulas add column if not exists nivel text;

comment on column aulas.turno is 'Mañana | Tarde (cabecera del acta diagnóstica MINEDU)';
comment on column aulas.nivel is 'Nivel educativo del aula: Inicial | Primaria | Secundaria';

-- Valores libres pero acotados a lo que la plantilla admite (null = no consignado).
alter table aulas drop constraint if exists aulas_turno_chk;
alter table aulas add constraint aulas_turno_chk
  check (turno is null or turno in ('Mañana', 'Tarde'));

alter table aulas drop constraint if exists aulas_nivel_chk;
alter table aulas add constraint aulas_nivel_chk
  check (nivel is null or nivel in ('Inicial', 'Primaria', 'Secundaria'));

commit;

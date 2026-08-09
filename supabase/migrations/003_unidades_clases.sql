-- Kipu: nombre de unidad, enlace sesión→unidad y relación unidad↔secciones.

-- 1. Nombre de la evidencia (usado por las unidades de aprendizaje).
alter table artifacts add column if not exists name text;

-- 2. Enlace de una sesión a la unidad a la que pertenece (null en otras entregas).
alter table artifacts add column if not exists unit_id uuid
  references artifacts(id) on delete set null;

-- 3. Secciones que cubre una unidad (una unidad puede abarcar varias clases).
create table if not exists unit_groups (
  unit_id  uuid not null references artifacts(id) on delete cascade,
  group_id uuid not null references student_groups(id) on delete cascade,
  primary key (unit_id, group_id)
);

-- RLS: misma visibilidad que artifacts (docente dueño, UGEL, director de la IE).
alter table unit_groups enable row level security;
drop policy if exists "teacher reads own unit_groups" on unit_groups; -- limpia posible policy ad-hoc previa
drop policy if exists unit_groups_read on unit_groups;
create policy unit_groups_read on unit_groups for select to authenticated
  using (exists (
    select 1 from artifacts a
    where a.id = unit_groups.unit_id
      and (a.teacher_id = auth.uid()
        or my_role() = 'ugel'
        or (my_role() = 'director' and a.institution_id = my_institution()))
  ));

-- 4. Backfill: cada unidad existente cubre, al menos, su propia sección.
insert into unit_groups (unit_id, group_id)
select id, group_id from artifacts
where type = 'MONTHLY_UNIT' and group_id is not null
on conflict do nothing;

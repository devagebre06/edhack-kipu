-- Kipu: contexto de contenido (IA) por versión y validez de la evidencia.
--
-- Motivación:
--   · Al analizar una UNIDAD se genera un "contexto" (área, temas, periodo) del
--     contenido del PDF. Ese contexto sirve para juzgar la coherencia de las
--     SESIONES que se cuelgan de la unidad (una sesión de comunicación no debe
--     poder registrarse dentro de una unidad de matemática).
--   · El contexto NO es visible para el docente: vive en una tabla aparte cuya
--     RLS solo permite leer a UGEL y al director de la institución. El backend
--     (service role) lo escribe y lo lee sin restricción.
--   · La validez (is_valid) SÍ es visible para el docente: una entrega que no
--     alcanza el umbral de puntaje —o una sesión incoherente con su unidad—
--     igual se sube y se conserva, pero no cuenta como sesión/unidad válida.

-- 1. Validez de la versión (visible para el docente).
alter table artifact_versions
  add column if not exists is_valid boolean not null default false,
  add column if not exists invalid_reason text;

-- 2. Contexto de contenido generado por la IA (oculto para el docente).
create table if not exists artifact_contexts (
  version_id  uuid primary key references artifact_versions(id) on delete cascade,
  artifact_id uuid not null references artifacts(id) on delete cascade,
  context     jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists artifact_contexts_artifact_idx on artifact_contexts(artifact_id);

alter table artifact_contexts enable row level security;
drop policy if exists artctx_read on artifact_contexts;
-- El docente dueño NO puede leer su contexto; sí UGEL y el director de la IE.
create policy artctx_read on artifact_contexts for select to authenticated
  using (
    my_role() = 'ugel'
    or (my_role() = 'director' and exists (
      select 1 from artifacts a
      where a.id = artifact_contexts.artifact_id and a.institution_id = my_institution()))
  );

-- =============================================================================
-- Kipu · 014 — Alertas en vivo (Supabase Realtime)
-- =============================================================================
-- El panel UGEL muestra las últimas alertas. Para que la lista se mantenga al
-- día sin recargar, el front se suscribe a los cambios de `alertas` por
-- Postgres Changes. Eso exige dos cosas del lado de la base:
--
--   1. Que la tabla esté en la publicación `supabase_realtime`.
--   2. `replica identity full`: sin ella, los eventos UPDATE/DELETE solo traen
--      la llave primaria, y Realtime no puede evaluar la RLS del suscriptor
--      (que es lo que impide que un director reciba alertas de otro colegio).
--
-- La RLS existente sigue mandando: cada quien recibe en vivo exactamente lo que
-- podría leer con un select.
-- =============================================================================

begin;

alter table alertas replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alertas'
  ) then
    alter publication supabase_realtime add table alertas;
  end if;
end $$;

commit;

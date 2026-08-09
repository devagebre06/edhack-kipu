-- =============================================================================
-- Kipu · 009 — Hardening: vistas con security_invoker
-- =============================================================================
-- Por defecto una VIEW en Postgres corre con los privilegios de su DUEÑO
-- (security definer implícito) y por tanto IGNORA la RLS de las tablas base para
-- el usuario que la consulta. El Security Advisor de Supabase lo marca CRITICAL.
--
-- Con security_invoker = on, la vista se ejecuta con los privilegios y la RLS del
-- usuario que consulta. El backend las lee con service_role (que ignora RLS de
-- todos modos), así que el panel UGEL sigue viendo todo; una lectura directa
-- desde el front quedaría acotada por la RLS del rol. Requiere Postgres 15+.
-- =============================================================================

begin;

alter view vw_mapa_colegio_curso   set (security_invoker = on);
alter view vw_profesor_resumen     set (security_invoker = on);
alter view vw_alumnos_por_profesor set (security_invoker = on);
alter view vw_notas_agregadas      set (security_invoker = on);

commit;

-- =============================================================================
-- Kipu · 013 — Vista `vw_periodo_aula_resumen` (evolución agregada por periodo)
-- =============================================================================
-- Con cuatro bimestres, `vw_alumno_nota_periodo` pasó de 5 286 a 8 596 filas, y
-- el listado de alumnos las paginaba enteras en cada carga solo para dibujar la
-- línea de evolución: ~4,8 s por request.
--
-- Esta vista pre-agrega al grano periodo × aula × curso (300 filas), que es lo
-- que el gráfico necesita y además permite filtrar por colegio o aula sin volver
-- al detalle. El listado en sí sigue leyendo `vw_alumno_resumen` (881 filas).
-- =============================================================================

begin;

create or replace view vw_periodo_aula_resumen with (security_invoker = on) as
select
  b.periodo_id,
  b.periodo_nombre,
  b.periodo_tipo,
  b.bimestre,
  b.fecha,
  b.colegio_id,
  b.colegio_nombre,
  b.aula_id,
  b.aula_nombre,
  b.grado, b.seccion, b.turno,
  b.curso_id,
  b.course_key,
  b.curso_nombre,
  b.profesor_id,
  b.profesor_nombre,
  count(*)                                        as alumnos,
  count(*) filter (where b.nivel = 'C')           as en_inicio,
  count(*) filter (where b.nivel = 'B')           as en_proceso,
  count(*) filter (where b.nivel in ('A','AD'))   as logrado,
  round(avg(b.promedio)::numeric, 2)              as promedio
from vw_alumno_nota_periodo b
group by b.periodo_id, b.periodo_nombre, b.periodo_tipo, b.bimestre, b.fecha,
         b.colegio_id, b.colegio_nombre, b.aula_id, b.aula_nombre,
         b.grado, b.seccion, b.turno,
         b.curso_id, b.course_key, b.curso_nombre, b.profesor_id, b.profesor_nombre;

commit;

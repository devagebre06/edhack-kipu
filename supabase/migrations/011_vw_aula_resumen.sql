-- =============================================================================
-- Kipu · 011 — Vista `vw_aula_resumen` (logro diagnóstico por aula × curso)
-- =============================================================================
-- El panel UGEL tiene una tarjeta "Grupos con calificaciones preocupantes" que
-- salía siempre vacía porque no existía forma de leer las notas agregadas POR
-- AULA: `vw_notas_agregadas` es por alumno y `vw_mapa_colegio_curso` agrega al
-- nivel del colegio. Consultar `notas` en crudo desde el front tampoco sirve:
-- son ~1 800 filas GENERAL y PostgREST corta en 1 000.
--
-- Esta vista devuelve una fila por aula × curso (60 hoy) con el reparto de
-- niveles de logro, lista para ordenar por "% en inicio".
--
-- security_invoker = on: respeta la RLS del que consulta (igual que 009).
-- =============================================================================

begin;

create or replace view vw_aula_resumen with (security_invoker = on) as
select
  a.id                                            as aula_id,
  a.codigo                                        as section_key,
  a.grado, a.seccion, a.turno, a.nivel,
  coalesce(a.nombre, concat_ws(' ', a.grado, a.seccion)) as aula_nombre,
  c.id                                            as colegio_id,
  c.nombre                                        as colegio_nombre,
  cu.id                                           as curso_id,
  cu.codigo                                       as course_key,
  cu.nombre                                       as curso_nombre,
  count(n.*)                                      as total,
  count(*) filter (where el.codigo = 'C')         as en_inicio,
  count(*) filter (where el.codigo = 'B')         as en_proceso,
  count(*) filter (where el.codigo in ('A','AD')) as logrado,
  round(avg(n.puntaje_numerico)::numeric, 2)      as promedio
from notas n
join dictados d  on d.id = n.dictado_id
join aulas a     on a.id = d.aula_id
join colegios c  on c.id = a.colegio_id
join cursos cu   on cu.id = n.curso_id
left join escala_logro el on el.id = n.escala_id
where n.competencia = 'GENERAL' and n.tipo_evaluacion = 'DIAGNOSTICO'
group by a.id, a.codigo, a.grado, a.seccion, a.turno, a.nivel, a.nombre,
         c.id, c.nombre, cu.id, cu.codigo, cu.nombre;

commit;

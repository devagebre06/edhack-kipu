-- =============================================================================
-- Kipu · 012 — Vistas de alumno: serie temporal de notas y resumen por alumno
-- =============================================================================
-- Las secciones "Profesores" y "Alumnos" del panel UGEL necesitan leer la nota
-- de cada alumno A LO LARGO DEL TIEMPO (diagnóstico → bimestre 1 → bimestre 2) y
-- relacionarla con su aula, su colegio y su docente. Hacerlo en crudo desde el
-- cliente no es viable: son ~5 300 filas GENERAL y PostgREST corta en 1 000.
--
--   vw_alumno_nota_periodo — grano fino: alumno × curso × periodo (la serie).
--   vw_alumno_resumen      — una fila por alumno: dónde empezó, dónde está y
--                            cuánto avanzó. Alimenta la tabla del listado.
--
-- Ambas con security_invoker = on (respetan la RLS del que consulta, igual 009).
-- =============================================================================

begin;

-- ── Serie: la nota GENERAL de un alumno en un curso y un periodo ─────────────
create or replace view vw_alumno_nota_periodo with (security_invoker = on) as
select
  n.id                                   as nota_id,
  a.id                                   as alumno_id,
  a.codigo                               as alumno_codigo,
  a.nombre_completo                      as alumno_nombre,
  a.numero                               as alumno_numero,
  c.id                                   as colegio_id,
  c.nombre                               as colegio_nombre,
  au.id                                  as aula_id,
  au.grado, au.seccion, au.turno,
  coalesce(au.nombre, concat_ws(' ', au.grado, au.seccion)) as aula_nombre,
  cu.id                                  as curso_id,
  cu.codigo                              as course_key,
  cu.nombre                              as curso_nombre,
  d.id                                   as dictado_id,
  d.profesor_id,
  pu.nombre_completo                     as profesor_nombre,
  p.id                                   as periodo_id,
  p.nombre                               as periodo_nombre,
  p.tipo                                 as periodo_tipo,
  p.bimestre,
  p.fecha_fin                            as fecha,
  n.tipo_evaluacion,
  n.puntaje_numerico                     as promedio,
  el.codigo                              as nivel,
  el.nombre                              as nivel_nombre
from notas n
join alumnos a              on a.id = n.alumno_id
join colegios c             on c.id = a.colegio_id
join cursos cu              on cu.id = n.curso_id
join periodos_academicos p  on p.id = n.periodo_id
left join dictados d        on d.id = n.dictado_id
left join aulas au          on au.id = d.aula_id
left join usuarios pu       on pu.id = d.profesor_id
left join escala_logro el   on el.id = n.escala_id
where n.competencia = 'GENERAL';

-- ── Resumen: una fila por alumno (punto de partida, actual y avance) ─────────
create or replace view vw_alumno_resumen with (security_invoker = on) as
with ultimo as (
  select alumno_id, max(fecha) as fecha_max
  from vw_alumno_nota_periodo
  group by alumno_id
)
select
  b.alumno_id,
  min(b.alumno_codigo)                                   as alumno_codigo,
  min(b.alumno_nombre)                                   as alumno_nombre,
  min(b.alumno_numero)                                   as alumno_numero,
  min(b.colegio_id::text)::uuid                          as colegio_id,
  min(b.colegio_nombre)                                  as colegio_nombre,
  min(b.aula_id::text)::uuid                             as aula_id,
  min(b.grado)                                           as grado,
  min(b.seccion)                                         as seccion,
  min(b.turno)                                           as turno,
  min(b.aula_nombre)                                     as aula_nombre,
  count(*)                                               as notas,
  count(distinct b.periodo_id)                           as periodos,
  count(distinct b.curso_id)                             as cursos,
  round(avg(b.promedio) filter (where b.periodo_tipo = 'DIAGNOSTICO')::numeric, 2) as promedio_diagnostico,
  round(avg(b.promedio) filter (where b.fecha = u.fecha_max)::numeric, 2)          as promedio_actual,
  round(avg(b.promedio)::numeric, 2)                     as promedio_global,
  max(u.fecha_max)                                       as fecha_ultima
from vw_alumno_nota_periodo b
join ultimo u on u.alumno_id = b.alumno_id
group by b.alumno_id;

commit;

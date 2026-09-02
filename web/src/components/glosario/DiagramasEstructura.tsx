// Diagramas del glosario · Estructura educativa.
import { GraduationCap, LayoutDashboard, Globe } from 'lucide-react'
import { Marco } from './primitivas'

/** Anatomía de un aula: qué tres datos la identifican y qué cuelga de ella. */
export function AnatomiaAula() {
  return (
    <Marco pie="La misma nómina se evalúa en las dos áreas, con un docente por área.">
      <div className="rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { et: 'Grado', v: '1°', nota: '1° a 6°' },
            { et: 'Sección', v: 'A', nota: 'A a F' },
            { et: 'Turno', v: 'Mañana', nota: 'o tarde' },
          ].map((x) => (
            <div key={x.et} className="rounded-md border px-2.5 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{x.et}</div>
              <div className="text-sm font-semibold">{x.v}</div>
              <div className="text-[10px] text-muted-foreground">{x.nota}</div>
            </div>
          ))}
          <span className="text-muted-foreground">=</span>
          <span className="rounded-md bg-primary px-2.5 py-1.5 text-sm font-semibold text-primary-foreground">1° A · Mañana</span>
        </div>
        <div className="mt-3 grid gap-1.5 text-xs sm:grid-cols-3">
          {[
            ['33 alumnos', 'matriculados en el periodo'],
            ['2 dictados', 'Matemática y Comunicación'],
            ['1 colegio', 'al que pertenece'],
          ].map(([a, b]) => (
            <div key={a} className="rounded-md bg-muted/60 px-2.5 py-1.5">
              <div className="font-medium">{a}</div>
              <div className="text-[10px] text-muted-foreground">{b}</div>
            </div>
          ))}
        </div>
      </div>
    </Marco>
  )
}

/** El dictado como cruce: cuatro cosas entran, y de él cuelga lo demás. */
export function CruceDictado() {
  const entra = ['Docente', 'Aula', 'Curso', 'Periodo']
  const sale = ['Horarios', 'Unidades', 'Sesiones', 'Notas']
  return (
    <Marco pie="Sin dictado no hay forma de saber quién enseña qué a quién.">
      <div className="flex flex-col items-center gap-2 rounded-lg border p-3 sm:flex-row sm:justify-between">
        <ul className="grid w-full gap-1 sm:w-auto">
          {entra.map((e) => (
            <li key={e} className="rounded-md border px-2 py-1 text-center text-[11px] sm:text-left">{e}</li>
          ))}
        </ul>
        <span className="text-muted-foreground">→</span>
        <span className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Dictado</span>
        <span className="text-muted-foreground">→</span>
        <ul className="grid w-full gap-1 sm:w-auto">
          {sale.map((e) => (
            <li key={e} className="rounded-md bg-muted/60 px-2 py-1 text-center text-[11px] sm:text-left">{e}</li>
          ))}
        </ul>
      </div>
    </Marco>
  )
}

/** Qué alcanza a ver cada rol: de lo más amplio a lo más acotado. */
export function AlcanceRoles() {
  const roles = [
    { rol: 'UGEL', icono: Globe, alcance: 'Toda la UGEL', detalle: '166 colegios · agregado', ancho: 100 },
    { rol: 'Director', icono: LayoutDashboard, alcance: 'Su institución', detalle: 'aulas, docentes y alertas', ancho: 55 },
    { rol: 'Profesor', icono: GraduationCap, alcance: 'Sus aulas', detalle: 'sus entregas y su retroalimentación', ancho: 25 },
  ]
  return (
    <Marco pie="El alcance no es una preferencia: lo impone la base de datos para cada sesión.">
      <ul className="space-y-2">
        {roles.map(({ rol, icono: Icono, alcance, detalle, ancho }) => (
          <li key={rol} className="flex items-center gap-2.5">
            <Icono className="size-4 shrink-0 text-muted-foreground" />
            <span className="w-16 shrink-0 text-xs font-medium">{rol}</span>
            <span className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
              <span
                className="flex h-full items-center rounded-md bg-primary/85 px-2 text-[10px] font-medium text-primary-foreground"
                style={{ width: `${ancho}%` }}
              >
                {alcance}
              </span>
            </span>
            <span className="hidden w-44 shrink-0 text-[10px] text-muted-foreground sm:block">{detalle}</span>
          </li>
        ))}
      </ul>
    </Marco>
  )
}

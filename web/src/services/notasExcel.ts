// Plantilla e importación de notas en Excel.
//
// Se hace en el navegador con SheetJS (ya es dependencia del front): el backend
// solo recibe JSON ya validado. La plantilla replica la nómina del acta MINEDU —
// N°, código, alumno y una columna por competencia— para que el docente reconozca
// el formato con el que ya trabaja.
import * as XLSX from 'xlsx'
import type { RegistroNotas } from '@/types'

const HOJA_NOTAS = 'Notas'
const HOJA_AYUDA = 'Instrucciones'
/** Columnas fijas antes de las competencias. */
const CABECERA = ['N°', 'Código', 'Alumno']

const nombreArchivo = (r: RegistroNotas) =>
  `notas-${[r.dictado.curso, r.dictado.aula, r.periodo.nombre].filter(Boolean).join('-')}`
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.xlsx'

/** Genera y descarga la plantilla con la nómina del aula ya rellenada. */
export function descargarPlantilla(registro: RegistroNotas) {
  const competencias = registro.competencias.map(c => c.codigo)
  const filas = registro.alumnos.map((a, i) => [
    a.numero ?? i + 1,
    a.codigo ?? '',
    a.nombre,
    // Se precargan las notas ya registradas para poder corregirlas sobre el mismo archivo.
    ...competencias.map(c => a.notas[c] ?? ''),
  ])

  const hoja = XLSX.utils.aoa_to_sheet([
    [`${registro.dictado.curso ?? ''} · ${registro.dictado.aula} · ${registro.periodo.nombre}`],
    [`${registro.dictado.colegio ?? ''}${registro.dictado.turno ? ` · Turno ${registro.dictado.turno}` : ''}`],
    [],
    [...CABECERA, ...competencias],
    ...filas,
  ])
  hoja['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 34 }, ...competencias.map(() => ({ wch: 8 }))]

  const ayuda = XLSX.utils.aoa_to_sheet([
    ['Cómo llenar esta plantilla'],
    [],
    ['1. Escribe el nivel de logro en la columna de cada competencia.'],
    ['2. Valores aceptados (mayúsculas o minúsculas):'],
    ...registro.escala.map(e => ['', e.codigo, e.nombre, `vale ${e.valor}`]),
    ['3. Deja la celda vacía si aún no evaluaste esa competencia.'],
    ['4. No cambies el orden de las columnas ni borres la fila de encabezados.'],
    ['5. Guarda el archivo y súbelo desde «Registro de notas».'],
    [],
    ['Competencias de este curso'],
    ...registro.competencias.map(c => ['', c.codigo, c.nombre]),
    [],
    ['La nota general se calcula sola: es el promedio de las competencias registradas.'],
  ])
  ayuda['!cols'] = [{ wch: 3 }, { wch: 8 }, { wch: 52 }, { wch: 10 }]

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, HOJA_NOTAS)
  XLSX.utils.book_append_sheet(libro, ayuda, HOJA_AYUDA)
  XLSX.writeFile(libro, nombreArchivo(registro))
}

export type ResultadoImport = {
  /** Notas leídas por alumno: { alumnoId: { C1: 'A' } }. */
  notas: Record<string, Record<string, string>>
  reconocidos: number
  avisos: string[]
}

/**
 * Lee un archivo de notas y lo casa contra la nómina. Empareja por código de
 * alumno y, si falta, por nombre normalizado — el docente puede haber exportado
 * la plantilla y reordenado filas.
 */
export async function leerExcelNotas(archivo: File, registro: RegistroNotas): Promise<ResultadoImport> {
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' })
  const hoja = libro.Sheets[HOJA_NOTAS] ?? libro.Sheets[libro.SheetNames[0]]
  if (!hoja) throw new Error('El archivo no tiene ninguna hoja legible.')

  const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, blankrows: false }) as unknown[][]
  const norm = (v: unknown) => String(v ?? '').trim()
  const clave = (v: unknown) => norm(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  // La fila de encabezados es la que contiene «Alumno».
  const iCab = matriz.findIndex(f => f.some(c => clave(c) === 'alumno'))
  if (iCab < 0) throw new Error('No se encontró la fila de encabezados (debe incluir la columna «Alumno»).')
  const cab = matriz[iCab].map(clave)

  const colCodigo = cab.findIndex(c => c === 'codigo')
  const colNombre = cab.findIndex(c => c === 'alumno')
  const competencias = registro.competencias.map(c => c.codigo)
  const colDe = new Map(competencias.map(c => [c, cab.findIndex(x => x === c.toLowerCase())]))

  const faltantes = competencias.filter(c => (colDe.get(c) ?? -1) < 0)
  if (faltantes.length === competencias.length) {
    throw new Error(`El archivo no tiene columnas de competencias (${competencias.join(', ')}).`)
  }

  const porCodigo = new Map(registro.alumnos.filter(a => a.codigo).map(a => [clave(a.codigo), a.id]))
  const porNombre = new Map(registro.alumnos.map(a => [clave(a.nombre), a.id]))
  const validos = new Set(registro.escala.map(e => e.codigo))

  const notas: Record<string, Record<string, string>> = {}
  const avisos: string[] = []
  if (faltantes.length) avisos.push(`Sin columna para ${faltantes.join(', ')}: esas competencias no se tocaron.`)

  let sinCasar = 0
  for (const fila of matriz.slice(iCab + 1)) {
    const cod = colCodigo >= 0 ? clave(fila[colCodigo]) : ''
    const nom = colNombre >= 0 ? clave(fila[colNombre]) : ''
    if (!cod && !nom) continue
    const alumnoId = porCodigo.get(cod) ?? porNombre.get(nom)
    if (!alumnoId) { sinCasar++; continue }

    for (const c of competencias) {
      const col = colDe.get(c) ?? -1
      if (col < 0) continue
      const bruto = norm(fila[col]).toUpperCase()
      if (!bruto) continue
      if (!validos.has(bruto)) {
        avisos.push(`«${bruto}» no es un nivel válido (${[...validos].join(', ')}); se omitió.`)
        continue
      }
      ;(notas[alumnoId] ??= {})[c] = bruto
    }
  }
  if (sinCasar) avisos.push(`${sinCasar} fila(s) no coinciden con ningún alumno de esta aula y se omitieron.`)

  return { notas, reconocidos: Object.keys(notas).length, avisos: [...new Set(avisos)] }
}

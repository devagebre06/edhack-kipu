// Árbol de la jerarquía institucional para el glosario: UGEL → red → colegio →
// aula → alumnos. Se dibuja en SVG (sin dependencias) a partir de la estructura
// de datos de abajo: el layout se calcula, no está posicionado a mano, así que
// añadir o quitar una rama no obliga a recolocar nada.
//
// Solo la primera rama de cada nivel se expande —es como se lee una jerarquía—
// y las demás quedan atenuadas con «…» para mostrar que hay más de una.

type Nodo = {
  label: string
  /** Segunda línea, más pequeña: el dato concreto del ejemplo. */
  sub?: string
  hijos?: Nodo[]
  /** Rama no expandida: se pinta tenue para insinuar que hay más. */
  tenue?: boolean
}

const ARBOL: Nodo = {
  label: 'UGEL 06',
  sub: 'la unidad de gestión',
  hijos: [
    {
      label: 'REI 01',
      sub: 'red / canal',
      hijos: [
        {
          label: 'ANGELITOS DE MARIA',
          sub: 'colegio · Cieneguilla',
          hijos: [
            { label: '4° A · Mañana', sub: 'aula', hijos: [{ label: '33 alumnos', sub: 'matriculados' }] },
            { label: '4° B · Mañana', sub: 'aula', hijos: [{ label: '29 alumnos', sub: 'matriculados' }] },
          ],
        },
        { label: 'PAMPAS TINAJAS', sub: '+ 13 colegios más', tenue: true },
      ],
    },
    { label: 'REI 02', sub: 'red / canal', tenue: true },
    { label: 'REI 03', sub: 'red / canal', tenue: true },
  ],
}

const NIVELES = ['UGEL', 'Red / canal', 'Colegio', 'Aula', 'Alumnos']

// ── Geometría ────────────────────────────────────────────────────────────────
const ANCHO_COL = 188   // separación horizontal entre niveles
const ANCHO_CAJA = 158
const ALTO_CAJA = 40
const ALTO_FILA = 56    // separación vertical entre hojas
const MARGEN_TOP = 34   // deja sitio a la fila de etiquetas de nivel

type Colocado = Nodo & { x: number; y: number; nivel: number; hijosColocados: Colocado[] }

/** Layout clásico de árbol: cada hoja ocupa una fila; cada padre se centra sobre sus hijos. */
function colocar(nodo: Nodo, nivel = 0, cursor = { fila: 0 }): Colocado {
  const hijos = (nodo.hijos ?? []).map((h) => colocar(h, nivel + 1, cursor))
  const y = hijos.length
    ? (hijos[0].y + hijos[hijos.length - 1].y) / 2
    : MARGEN_TOP + cursor.fila++ * ALTO_FILA + ALTO_CAJA / 2
  return { ...nodo, x: nivel * ANCHO_COL, y, nivel, hijosColocados: hijos }
}

function aplanar(n: Colocado): Colocado[] {
  return [n, ...n.hijosColocados.flatMap(aplanar)]
}

export function ArbolJerarquia() {
  const raiz = colocar(ARBOL)
  const nodos = aplanar(raiz)
  const alto = Math.max(...nodos.map((n) => n.y)) + ALTO_CAJA
  const ancho = (NIVELES.length - 1) * ANCHO_COL + ANCHO_CAJA

  return (
    <figure className="mt-3">
      {/* El SVG se dibuja siempre a su tamaño natural: estirarlo agranda su
          tipografía y encogerlo la vuelve ilegible. En pantallas estrechas se
          desplaza en horizontal, como cualquier diagrama. */}
      <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${ancho} ${alto + 8}`}
        style={{ width: ancho, minWidth: ancho }}
        className="h-auto max-w-full"
        role="img"
        aria-label="Árbol de la jerarquía: UGEL, red o canal, colegio, aula y alumnos"
      >
        {/* Etiqueta de cada nivel */}
        {NIVELES.map((nivel, i) => (
          <text
            key={nivel}
            x={i * ANCHO_COL}
            y={12}
            className="fill-muted-foreground"
            style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            {nivel.toUpperCase()}
          </text>
        ))}

        {/* Conectores ortogonales padre → hijo */}
        {nodos.flatMap((padre) =>
          padre.hijosColocados.map((hijo) => {
            const x1 = padre.x + ANCHO_CAJA
            const x2 = hijo.x
            const medio = x1 + (x2 - x1) / 2
            return (
              <path
                key={`${padre.label}-${hijo.label}`}
                d={`M ${x1} ${padre.y} H ${medio} V ${hijo.y} H ${x2}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.25}
                className={hijo.tenue ? 'text-border' : 'text-muted-foreground/50'}
              />
            )
          }),
        )}

        {/* Nodos */}
        {nodos.map((n) => (
          <g key={`${n.nivel}-${n.label}`} className={n.tenue ? 'opacity-55' : undefined}>
            <rect
              x={n.x}
              y={n.y - ALTO_CAJA / 2}
              width={ANCHO_CAJA}
              height={ALTO_CAJA}
              rx={8}
              className="fill-card stroke-border"
              strokeWidth={1}
            />
            <text x={n.x + 10} y={n.y - 2} className="fill-foreground" style={{ fontSize: 11.5, fontWeight: 600 }}>
              {n.label}
            </text>
            {n.sub && (
              <text x={n.x + 10} y={n.y + 12} className="fill-muted-foreground" style={{ fontSize: 10 }}>
                {n.sub}
              </text>
            )}
          </g>
        ))}
      </svg>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Cada nivel contiene varios del siguiente; el ejemplo sigue una sola rama. Todo dato de la plataforma —usuarios,
        notas, evidencias y alertas— cuelga de algún punto de esta cadena.
      </figcaption>
    </figure>
  )
}

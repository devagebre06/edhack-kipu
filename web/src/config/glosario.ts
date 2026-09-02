// ─────────────────────────────────────────────────────────────
// Glosario universal de Kipu: qué significa cada dato de la app.
//
// Es la fuente única del diccionario que se pinta en /glosario. Cada entrada
// describe un concepto del dominio, sus valores posibles (con el mismo color
// que usa la UI) y dónde se ve. Si cambia una regla de negocio —un umbral, un
// peso del scoring, una escala— se actualiza aquí y la sección lo refleja.
// ─────────────────────────────────────────────────────────────

export type ValorGlosario = {
  clave: string
  etiqueta: string
  nota?: string
  color?: string
}

export type EntradaGlosario = {
  termino: string
  /** Una frase: qué es, en el lenguaje del docente. */
  definicion: string
  valores?: ValorGlosario[]
  /** Cómo se calcula o de dónde sale el dato. */
  calculo?: string
  /** Dónde se ve en la app. */
  donde?: string
  /** Peso de la entrada en el bento: cuanto mayor, más ancha queda la tarjeta. */
  span?: 1 | 2 | 4
  /** Diagrama que acompaña a la definición (ver components/glosario). */
  grafico?: string
  /** Icono de lucide que encabeza la tarjeta (nombre resuelto en la página). */
  icono?: string
}

export type GrupoGlosario = {
  clave: string
  titulo: string
  descripcion: string
  entradas: EntradaGlosario[]
}

export const GLOSARIO: GrupoGlosario[] = [
  {
    clave: 'aprendizaje',
    titulo: 'Aprendizaje',
    descripcion: 'Cómo se mide y se registra el logro de cada estudiante.',
    entradas: [
      {
        termino: 'Escala de logro',
        definicion: 'La escala oficial del MINEDU con la que se califica cada competencia. Es cualitativa, no una nota del 0 al 20.',
        span: 2,
        icono: 'Gauge',
        grafico: 'escala',
                calculo: 'El valor numérico (1 a 4) permite promediar; los promedios de la app siempre están en esa escala.',
        donde: 'Notas de alumnos, mapa diagnóstico, fichas de docente y aula.',
      },
      {
        termino: 'Nota general',
        definicion: 'El nivel del estudiante en un área y un periodo, resumiendo todas sus competencias.',
        span: 2,
        icono: 'Sigma',
        grafico: 'nota-general',
        calculo: 'Promedio numérico de sus competencias (C=1 … AD=4), redondeado al entero más cercano.',
        donde: 'Ficha del alumno · gráfica «Notas en el tiempo».',
      },
      {
        termino: 'Competencia',
        definicion: 'Cada capacidad del CNEB que se evalúa por separado dentro de un área. Matemática tiene cuatro; Comunicación, tres.',
        span: 2,
        icono: 'Target',
        grafico: 'competencias',
                donde: 'Ficha del alumno y del docente · desglose por competencia.',
      },
      {
        termino: 'Periodo',
        definicion: 'El momento del año al que pertenece una evaluación. Es el eje de todas las gráficas de evolución.',
        span: 4,
        icono: 'CalendarRange',
        grafico: 'periodos',
                calculo: 'Las series usan la fecha de cierre del periodo.',
      },
      {
        termino: 'Evaluación diagnóstica',
        definicion: 'La primera medición del año, con el formato de la plantilla del MINEDU: un acta por aula y área, con la nómina completa.',
        icono: 'ClipboardList',
        grafico: 'acta',
        donde: 'Mapa diagnóstico · panel UGEL.',
      },
      {
        termino: 'Avance',
        definicion: 'Cuánto se movió un alumno o un aula desde el diagnóstico hasta su última evaluación.',
        icono: 'TrendingUp',
        grafico: 'avance',
        calculo: 'Promedio actual − promedio del diagnóstico, en la escala 1-4. Positivo = mejoró.',
        donde: 'Listado y ficha de alumnos · aulas del docente.',
      },
    ],
  },
  {
    clave: 'estructura',
    titulo: 'Estructura educativa',
    descripcion: 'Cómo se organiza la UGEL, sus colegios y sus aulas.',
    entradas: [
      {
        termino: 'Jerarquía institucional',
        definicion: 'La cadena a la que pertenece todo dato de la plataforma. El colegio es la institución: de él cuelgan usuarios, aulas, alumnos y alertas.',
        icono: 'Network',
        span: 4,
        grafico: 'jerarquia',
        valores: [
          { clave: 'UGEL', etiqueta: 'Unidad de Gestión Educativa Local (aquí, la 06)' },
          { clave: 'Red / canal', etiqueta: 'agrupación de colegios (REI) o distrito' },
          { clave: 'Colegio', etiqueta: 'la institución educativa' },
          { clave: 'Aula', etiqueta: 'grado + sección + turno' },
          { clave: 'Alumno', etiqueta: 'matriculado en un aula por periodo' },
        ],
      },
      {
        termino: 'Aula',
        definicion: 'Un grupo concreto de estudiantes: grado (1° a 6°), sección (A a F) y turno (mañana o tarde). La misma nómina se evalúa en las dos áreas.',
        grafico: 'aula',
        icono: 'Users',
        donde: 'Fichas de docente y alumno · grupos con calificaciones preocupantes.',
      },
      {
        termino: 'Dictado',
        definicion: 'La asignación de un docente a un aula para un curso en un periodo. Es el punto donde se cruzan profesor, alumnos y notas.',
        grafico: 'dictado',
        icono: 'Link2',
        calculo: 'De él cuelgan horarios, unidades y sesiones.',
      },
      {
        termino: 'Roles',
        definicion: 'Qué ve cada persona al iniciar sesión. Nadie ve datos fuera de su alcance.',
        grafico: 'roles',
        icono: 'ShieldCheck',
        span: 2,
              },
    ],
  },
  {
    clave: 'evidencias',
    titulo: 'Evidencias y evaluación',
    descripcion: 'Lo que el docente entrega y cómo lo valora la IA.',
    entradas: [
      {
        termino: 'Unidad y sesión',
        definicion: 'Los dos tipos de entrega. La unidad de aprendizaje agrupa varias sesiones de clase; cada una se sube y se evalúa por separado.',
        grafico: 'unidad-sesion',
        icono: 'FileText',
        span: 2,
        donde: 'Panel del docente · sección «Unidades y sesiones» de UGEL.',
      },
      {
        termino: 'Evidencia y versión',
        definicion: 'La evidencia es el documento entregado; cada corrección que sube el docente crea una versión nueva sin borrar la anterior.',
        grafico: 'versiones',
        icono: 'Layers',
        calculo: 'El historial es inmutable: cada versión es un nudo en la cuerda del quipu.',
      },
      {
        termino: 'Estado de la entrega',
        definicion: 'En qué punto del circuito está un documento entregado.',
        grafico: 'estados-entrega',
        icono: 'CircleDot',
        span: 2,
              },
      {
        termino: 'Validez de la entrega',
        definicion: 'Una entrega puede estar registrada pero no contar como sesión o unidad válida.',
        grafico: 'validez',
        icono: 'BadgeCheck',
        calculo: 'Cuenta si supera el puntaje mínimo (60/100) y —si es sesión— es coherente con su unidad.',
        donde: 'Chip «Válida / No válida» en el visor.',
      },
      {
        termino: 'Ficha de monitoreo',
        definicion: 'El instrumento con el que la IA valora cada entrega: 17 ítems repartidos en cuatro dimensiones, más cinco desempeños de aula.',
        grafico: 'ficha',
        icono: 'ClipboardCheck',
        span: 2,
                calculo: 'Cada ítem se valora Logrado (3), En proceso (2) o Inicio (1); los no aplicables no puntúan.',
      },
      {
        termino: 'Puntaje de la evaluación',
        definicion: 'El resultado de la ficha llevado a una escala de 0 a 100.',
        grafico: 'puntaje',
        icono: 'Percent',
        calculo: 'Puntaje obtenido ÷ puntaje máximo de los ítems aplicables × 100.',
        donde: 'Visor de la entrega · score por institución.',
      },
      {
        termino: 'Retroalimentación',
        definicion: 'Lo que la IA devuelve además del puntaje: la cita del documento que sustenta cada valoración y una recomendación accionable.',
        grafico: 'retroalimentacion',
        icono: 'MessageSquareQuote',
        span: 2,
        calculo: 'Siempre queda sujeta a revisión humana: la IA acompaña, no decide sola.',
      },
    ],
  },
  {
    clave: 'indicadores',
    titulo: 'Indicadores y scoring',
    descripcion: 'Los números derivados que resumen el desempeño.',
    entradas: [
      {
        termino: 'Niveles del mapa',
        definicion: 'Los tres grupos en que se resume la escala de logro para pintar colegios, aulas y docentes.',
        grafico: 'niveles-mapa',
        icono: 'Map',
        span: 2,
                donde: 'Mapa diagnóstico · distribución de cada docente y aula.',
      },
      {
        termino: 'Score del docente',
        definicion: 'Un número de 0 a 100 que resume el desempeño del docente leído desde las notas de sus alumnos.',
        grafico: 'score-docente',
        icono: 'Gauge',
        span: 2,
                calculo: 'La equidad penaliza al aula que avanza dejando atrás a una parte del grupo.',
        donde: 'Sección Profesores · tarjetas del mapa.',
      },
      {
        termino: 'Lectura del score',
        definicion: 'La etiqueta que acompaña al número. Describe una situación, no califica a la persona.',
        grafico: 'lectura-score',
        icono: 'Tags',
        span: 2,
              },
      {
        termino: 'Valor agregado',
        definicion: 'Cuánto rinde un docente por encima o por debajo de lo esperable en su entorno.',
        grafico: 'valor-agregado',
        icono: 'Scale',
        calculo: 'Su promedio menos el promedio de su distrito, en la escala 1-4. No entra en el score: es contexto, no mérito.',
      },
      {
        termino: 'Tasa de invalidez',
        definicion: 'Qué porcentaje de las entregas de una institución quedó observado.',
        grafico: 'invalidez',
        icono: 'AlertTriangle',
        calculo: 'Entregas «Necesita corrección» ÷ total de entregas.',
        donde: 'Panel UGEL · score por institución.',
      },
      {
        termino: '% en inicio',
        definicion: 'La proporción del aula que sigue en el nivel más bajo. Es la señal principal para priorizar acompañamiento.',
        grafico: 'en-inicio',
        icono: 'TriangleAlert',
        donde: 'Grupos con calificaciones preocupantes · aulas del docente.',
      },
    ],
  },
  {
    clave: 'alertas',
    titulo: 'Alertas',
    descripcion: 'Situaciones que el motor detecta solo, sobre datos ya cargados.',
    entradas: [
      {
        termino: 'Reglas del motor',
        definicion: 'Cada regla mira una fuente distinta y tiene un umbral ajustable desde el panel.',
        grafico: 'reglas',
        icono: 'Workflow',
        span: 4,
                calculo: 'Reejecutar el motor no duplica: si la situación ya tiene una alerta abierta, se omite.',
      },
      {
        termino: 'Severidad',
        definicion: 'Qué tan urgente es atender la alerta.',
        grafico: 'severidad',
        icono: 'Flame',
        span: 2,
              },
      {
        termino: 'Estado de la alerta',
        definicion: 'El recorrido de una alerta desde que aparece hasta que se cierra.',
        grafico: 'estados-alerta',
        icono: 'GitBranch',
        span: 2,
                calculo: 'Cada cambio queda registrado en el historial de la alerta y en la auditoría.',
      },
      {
        termino: 'Evidencia de la alerta',
        definicion: 'Los datos concretos que la originaron: el aula, el periodo, los números. Permite verificar la alerta sin salir de ella.',
        grafico: 'evidencia-alerta',
        icono: 'Search',
      },
      {
        termino: 'Origen',
        definicion: 'Quién creó la alerta: el motor de reglas, una persona a mano, o el sembrado de demostración.',
        grafico: 'origen-alerta',
        icono: 'Fingerprint',
      },
    ],
  },
  {
    clave: 'datos',
    titulo: 'Procedencia de los datos',
    descripcion: 'De dónde viene cada cifra y qué tan real es.',
    entradas: [
      {
        termino: 'Dato sintético',
        definicion: 'Información generada para poblar la demostración. Nunca son personas reales: los nombres de estudiantes y docentes son inventados.',
        grafico: 'sintetico',
        icono: 'FlaskConical',
        span: 2,
        calculo: 'Toda fila lleva una marca que distingue lo sintético de lo real.',
      },
      {
        termino: 'Colegios reales',
        definicion: 'Las 151 instituciones de la UGEL 06 con sus coordenadas oficiales del MINEDU. En el mapa se pueden separar de las de demostración.',
        grafico: 'colegios-reales',
        icono: 'MapPin',
        donde: 'Mapa diagnóstico · filtro «Datos».',
      },
      {
        termino: 'Adapter de ingesta',
        definicion: 'El mecanismo que permite incorporar un archivo nuevo relacionándolo con lo que ya existe, sin duplicar.',
        grafico: 'adapter',
        icono: 'ArrowLeftRight',
        calculo: 'Traduce la llave externa del archivo (código de colegio, DNI) al identificador interno.',
      },
      {
        termino: 'Trazabilidad',
        definicion: 'El principio del quipu: nada se sobrescribe. Cada versión, cada cambio de estado y cada evaluación quedan registrados y se pueden revisar después.',
        grafico: 'trazabilidad',
        icono: 'History',
        span: 2,
      },
    ],
  },
]

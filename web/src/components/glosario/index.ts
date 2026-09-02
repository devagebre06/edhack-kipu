// Registro de los diagramas del glosario: la clave es el valor de `grafico` en
// config/glosario.ts. Añadir uno nuevo es escribir el componente y registrarlo
// aquí; la página no necesita cambios.
import { ArbolJerarquia } from '../ArbolJerarquia'
import {
  EscalaLogro, FormulaNotaGeneral, CompetenciasPorArea, LineaTiempoPeriodos, MiniAvance, ActaDiagnostica,
} from './Diagramas'
import { AnatomiaAula, CruceDictado, AlcanceRoles } from './DiagramasEstructura'
import {
  UnidadYSesiones, VersionesEvidencia, CircuitoEstados, UmbralValidez,
  ComposicionFicha, CalculoPuntaje, EjemploRetroalimentacion,
} from './DiagramasEvidencias'
import {
  NivelesMapa, ComposicionScore, LecturaScore, ValorAgregado, TasaInvalidez, PorcentajeEnInicio,
} from './DiagramasIndicadores'
import {
  ReglasMotor, EscalaSeveridad, MaquinaEstadosAlerta, OrigenAlerta, EvidenciaAlerta,
  DatoSintetico, ColegiosReales, AdapterIngesta, CuerdaTrazabilidad,
} from './DiagramasAlertas'

export const GRAFICOS: Record<string, () => React.ReactElement> = {
  // Aprendizaje
  escala: EscalaLogro,
  'nota-general': FormulaNotaGeneral,
  competencias: CompetenciasPorArea,
  periodos: LineaTiempoPeriodos,
  avance: MiniAvance,
  acta: ActaDiagnostica,
  // Estructura
  jerarquia: ArbolJerarquia,
  aula: AnatomiaAula,
  dictado: CruceDictado,
  roles: AlcanceRoles,
  // Evidencias
  'unidad-sesion': UnidadYSesiones,
  versiones: VersionesEvidencia,
  'estados-entrega': CircuitoEstados,
  validez: UmbralValidez,
  ficha: ComposicionFicha,
  puntaje: CalculoPuntaje,
  retroalimentacion: EjemploRetroalimentacion,
  // Indicadores
  'niveles-mapa': NivelesMapa,
  'score-docente': ComposicionScore,
  'lectura-score': LecturaScore,
  'valor-agregado': ValorAgregado,
  invalidez: TasaInvalidez,
  'en-inicio': PorcentajeEnInicio,
  // Alertas
  reglas: ReglasMotor,
  severidad: EscalaSeveridad,
  'estados-alerta': MaquinaEstadosAlerta,
  'origen-alerta': OrigenAlerta,
  'evidencia-alerta': EvidenciaAlerta,
  // Procedencia
  sintetico: DatoSintetico,
  'colegios-reales': ColegiosReales,
  adapter: AdapterIngesta,
  trazabilidad: CuerdaTrazabilidad,
}

/** Diagramas que solo se leen bien ocupando la fila completa del bento. */
export const GRAFICOS_ANCHOS = new Set(['jerarquia', 'periodos', 'reglas', 'dictado'])

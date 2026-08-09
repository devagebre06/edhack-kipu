// Fecha/hora ancladas a la zona horaria del piloto (Perú), para que el listado
// de clases "de hoy" no dependa de la zona del navegador.
export const TIMEZONE = 'America/Lima'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Día de la semana (0=domingo) en la zona del piloto. */
export function zonedWeekday(date = new Date()): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'long' }).format(date)
  return WEEKDAYS.indexOf(name)
}

/** Fecha en formato YYYY-MM-DD en la zona del piloto (en-CA produce ISO). */
export function zonedYMD(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date)
}

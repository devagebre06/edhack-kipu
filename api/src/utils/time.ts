// Utilidades de fecha/hora ancladas a la zona horaria del piloto.
// Evita depender de la hora local del proceso (la API puede correr en UTC).
import { TIMEZONE } from '../config/env.ts'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Día de la semana (0=domingo) y hora "HH:MM" en la zona del piloto. */
export function zonedNow(date = new Date()): { weekday: number; hm: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return { weekday: WEEKDAYS.indexOf(get('weekday')), hm: `${get('hour')}:${get('minute')}` }
}

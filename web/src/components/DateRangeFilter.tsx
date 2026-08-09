// Filtro de rango de fechas reutilizable, con presets rápidos (hoy, ayer,
// últimos 7 días, este mes, el mes pasado) y una opción "Personalizado" que
// revela dos inputs de fecha. Emite `{ from, to }` en formato YYYY-MM-DD.
// "Hoy" se calcula en la zona horaria del piloto (ver config/time.ts).
import { useState } from 'react'
import { zonedYMD } from '@/config/time'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'

export type DateRange = { from: string; to: string }

// Aritmética de calendario sobre portadores UTC (evita corrimientos por DST).
const parseYMD = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const fmtYMD = (d: Date) => d.toISOString().slice(0, 10)
const mk = (y: number, m: number, d: number) => fmtYMD(new Date(Date.UTC(y, m, d)))

const PRESETS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'ayer', label: 'Ayer' },
  { key: '7d', label: 'Últimos 7 días' },
  { key: 'mes', label: 'Este mes' },
  { key: 'mesPasado', label: 'El mes pasado' },
] as const

// Sentinela para "cualquier fecha": shadcn Select no admite valores vacíos.
const ANY = 'all'

// Calcula el rango de un preset relativo a "hoy" (zona del piloto).
function presetRange(key: string): DateRange {
  const today = zonedYMD()
  const t = parseYMD(today)
  const y = t.getUTCFullYear(), m = t.getUTCMonth(), d = t.getUTCDate()
  switch (key) {
    case 'hoy': return { from: today, to: today }
    case 'ayer': { const x = mk(y, m, d - 1); return { from: x, to: x } }
    case '7d': return { from: mk(y, m, d - 6), to: today }
    case 'mes': return { from: mk(y, m, 1), to: today }
    case 'mesPasado': return { from: mk(y, m - 1, 1), to: mk(y, m, 0) } // día 0 del mes actual = último del anterior
    default: return { from: '', to: '' }
  }
}

const eq = (a: DateRange, b: DateRange) => a.from === b.from && a.to === b.to
const isEmpty = (r: DateRange) => !r.from && !r.to

export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [customOpen, setCustomOpen] = useState(false)
  // El preset seleccionado se deriva del valor actual (controlado); "Personalizado"
  // se muestra si el usuario lo abrió o si el rango no coincide con ningún preset.
  const matched = PRESETS.find(p => eq(presetRange(p.key), value))?.key
  const selected = customOpen ? 'custom' : isEmpty(value) ? ANY : matched ?? 'custom'

  const onSelect = (v: string) => {
    if (v === 'custom') { setCustomOpen(true); return }
    setCustomOpen(false)
    onChange(v === ANY ? { from: '', to: '' } : presetRange(v))
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select value={selected} onValueChange={onSelect}>
        <SelectTrigger aria-label="Filtrar por fecha" className="w-45">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Cualquier fecha</SelectItem>
          {PRESETS.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
          <SelectItem value="custom">Personalizado…</SelectItem>
        </SelectContent>
      </Select>
      {selected === 'custom' && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">Desde</Label>
            <Input type="date" value={value.from} max={value.to || undefined}
              onChange={e => onChange({ ...value, from: e.target.value })}
              aria-label="Fecha desde" className="w-38" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">Hasta</Label>
            <Input type="date" value={value.to} min={value.from || undefined}
              onChange={e => onChange({ ...value, to: e.target.value })}
              aria-label="Fecha hasta" className="w-38" />
          </div>
        </>
      )}
    </div>
  )
}

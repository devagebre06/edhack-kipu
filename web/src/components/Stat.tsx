import type React from 'react'
import { cn } from '@/lib/utils'

const TONE: Record<string, string> = {
  ok: 'text-success',
  warn: 'text-warning-foreground',
  bad: 'text-destructive',
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5 shadow-xs">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold tabular-nums tracking-tight', tone && TONE[tone])}>{value}</div>
    </div>
  )
}

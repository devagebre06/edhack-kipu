import type React from 'react'

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className={`text-2xl font-semibold ${tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : ''}`}>{value}</div>
    </div>
  )
}

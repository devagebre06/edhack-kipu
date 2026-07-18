import type React from "react"
// Vocabulario visual compartido: logo, badges, tarjetas, tabla.
export function Logo({ light = false, size = 22 }: { light?: boolean; size?: number }) {
  const c = light ? '#fff' : 'var(--color-brand)'
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight" style={{ fontSize: size, color: light ? '#fff' : 'var(--color-ink)' }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2v20" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="7" r="2.6" fill={c} />
        <circle cx="12" cy="13.5" r="2.1" fill={c} opacity=".75" />
        <circle cx="12" cy="19" r="1.6" fill={c} opacity=".5" />
      </svg>
      kipu
    </span>
  )
}

const STATUS_STYLE: Record<string, string> = {
  APPROVED: 'bg-ok-bg text-ok', NEEDS_REVISION: 'bg-warn-bg text-warn', PROCESSING: 'bg-line/50 text-ink-soft',
  MANUAL_REVIEW: 'bg-nav/10 text-nav', PROCESSING_ERROR: 'bg-bad-bg text-bad',
  NEW: 'bg-bad-bg text-bad', UNDER_REVIEW: 'bg-warn-bg text-warn', DISMISSED: 'bg-line/50 text-ink-soft',
  ESCALATED: 'bg-nav/10 text-nav', RESOLVED: 'bg-ok-bg text-ok',
  LOW: 'bg-line/50 text-ink-soft', MEDIUM: 'bg-warn-bg text-warn', HIGH: 'bg-bad-bg text-bad', CRITICAL: 'bg-bad text-white',
}
export function Badge({ value, label }: { value: string; label: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[value] || 'bg-line/50 text-ink-soft'}`}>{label}</span>
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className={`text-2xl font-semibold ${tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : ''}`}>{value}</div>
    </div>
  )
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-soft">{empty}</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-soft">
            {head.map(h => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((c, j) => <td key={j} className="px-4 py-2.5">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Spinner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 text-sm text-ink-soft" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      {text}
    </div>
  )
}

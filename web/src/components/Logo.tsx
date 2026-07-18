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

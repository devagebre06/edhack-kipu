import { BADGE_STYLE } from '@/config/labels'

export function Badge({ value, label }: { value: string; label: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLE[value] || 'bg-line/50 text-ink-soft'}`}>
      {label}
    </span>
  )
}

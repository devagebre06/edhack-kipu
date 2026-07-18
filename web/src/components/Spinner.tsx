export function Spinner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 text-sm text-ink-soft" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      {text}
    </div>
  )
}

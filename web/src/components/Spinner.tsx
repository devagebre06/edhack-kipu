import { Loader2 } from 'lucide-react'

export function Spinner({ text }: { text: string }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-xs"
      role="status"
    >
      <Loader2 className="size-4 animate-spin text-primary" />
      {text}
    </div>
  )
}

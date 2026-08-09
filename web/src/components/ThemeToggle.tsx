import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks'
import { cn } from '@/lib/utils'

/**
 * Botón para alternar entre tema claro y oscuro. `tone="sidebar"` lo adapta al
 * fondo oscuro de la barra lateral; por defecto usa los colores de contenido.
 */
export function ThemeToggle({ tone = 'default', className }: { tone?: 'default' | 'sidebar'; className?: string }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={isDark ? 'Tema claro' : 'Tema oscuro'}
      className={cn(
        'relative inline-grid size-9 place-items-center rounded-md transition-colors outline-none focus-visible:ring-2',
        tone === 'sidebar'
          ? 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-sidebar-ring/60'
          : 'border bg-card text-muted-foreground shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50',
        className,
      )}
    >
      <Sun className={cn('size-4 transition-all', isDark ? 'scale-0 -rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100')} />
      <Moon className={cn('absolute size-4 transition-all', isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 rotate-90 opacity-0')} />
    </button>
  )
}

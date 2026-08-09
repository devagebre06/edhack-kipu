import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** Toaster de la app. El tema (claro/oscuro) lo pasa el caller vía props. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error: 'group-[.toaster]:!text-destructive',
          success: 'group-[.toaster]:!text-success',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

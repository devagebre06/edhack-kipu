import type React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

/**
 * Modal centrado. Se monta ya abierto; al cerrarlo (Escape, clic fuera o la ✕)
 * invoca `onClose`. Envuelve el Dialog de Radix para foco, animación y a11y.
 */
export function Modal({ title, onClose, children }: { title?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        {title && (
          <DialogHeader className="border-b px-5 py-3.5">
            <DialogTitle className="text-base">{title}</DialogTitle>
          </DialogHeader>
        )}
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </DialogContent>
    </Dialog>
  )
}

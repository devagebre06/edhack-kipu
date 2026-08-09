import type React from 'react'
import {
  Table as UITable, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from './ui/table'

/** Tabla de datos simple (cabeceras + filas). Envuelve las primitivas de ui/table. */
export function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length)
    return (
      <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">{empty}</p>
    )
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <UITable>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {head.map((h) => <TableHead key={h}>{h}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((c, j) => <TableCell key={j} className="text-sm">{c}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </UITable>
    </div>
  )
}

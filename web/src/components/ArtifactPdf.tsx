import { useState } from 'react'
import { useArtifactFile } from '@/hooks'
import { Spinner } from './Spinner'

const isPdf = (name?: string) => !!name && name.toLowerCase().endsWith('.pdf')

function Fallback({ height, text, filename, action }: { height: string; text: string; filename?: string; action?: React.ReactNode }) {
  return (
    <div className={`grid ${height} place-content-center gap-2 bg-bg px-6 text-center`}>
      <p className="text-sm text-ink-soft">{text}</p>
      {filename && <p className="text-xs text-ink-soft/70">{filename}</p>}
      {action}
    </div>
  )
}

/**
 * Visor del documento de una versión. No carga nada hasta que el usuario pulsa
 * «Ver documento» (la URL firmada se pide solo al abrir), y ofrece abrirlo en
 * una pestaña nueva. `height` controla la altura del visor (clase de Tailwind).
 */
export function ArtifactPdf({ versionId, filename, height = 'h-80' }: { versionId?: string; filename?: string; height?: string }) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, isError } = useArtifactFile(versionId, open)

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)}
        className={`flex ${height} w-full flex-col items-center justify-center gap-2 bg-bg text-center transition-colors hover:bg-line/40`}>
        <svg className="size-8 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6" /><path d="M9 17h4" />
        </svg>
        <span className="text-sm font-medium text-brand">Ver documento</span>
        {filename && <span className="max-w-[80%] truncate text-xs text-ink-soft">{filename}</span>}
      </button>
    )
  if (isLoading) return <div className={`grid ${height} place-items-center bg-bg`}><Spinner text="Cargando documento…" /></div>
  if (isError || !data) return <Fallback height={height} text="No se pudo cargar el documento." filename={filename} />
  if (!data.url) return <Fallback height={height} text={data.note || 'Documento no disponible.'} filename={data.filename} />
  if (!isPdf(data.filename))
    return <Fallback height={height} text="Vista previa no disponible para este formato." filename={data.filename}
      action={<a href={data.url} target="_blank" rel="noreferrer"
        className="justify-self-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep">Abrir documento</a>} />

  return (
    <div className="flex flex-col">
      <iframe src={`${data.url}#toolbar=0&navpanes=0`} title={data.filename} className={`${height} w-full bg-bg`} />
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-1.5 text-xs">
        <span className="truncate text-ink-soft">{data.filename}</span>
        <a href={data.url} target="_blank" rel="noreferrer" className="shrink-0 text-brand underline hover:opacity-80">Abrir en pestaña nueva</a>
      </div>
    </div>
  )
}

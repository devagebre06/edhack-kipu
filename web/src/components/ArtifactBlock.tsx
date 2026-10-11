import { useState } from 'react'
import { STATUS_LABEL } from '@/config/labels'
import { latestVersion, latestEvaluation, previousEvaluation, isValid, invalidReason } from '@/factories'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from './ui'
import { Badge } from './Badge'
import { Modal } from './Modal'
import { ArtifactPdf } from './ArtifactPdf'
import { EvaluationView } from './evaluation/EvaluationView'
import { EvaluationAnnotations } from './evaluation/EvaluationAnnotations'
import type { Artifact } from '@/types'

/** Chip de validez de la entrega (verde = válida, ámbar = no cuenta). */
export function ValidityPill({ valid }: { valid: boolean }) {
  return valid
    ? <span className="inline-flex items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-xs font-medium text-success"><CheckCircle2 className="size-3" /> Válida</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-warning-muted px-2 py-0.5 text-xs font-medium text-warning-foreground"><AlertCircle className="size-3" /> No válida</span>
}

/**
 * Visor de una entrega (unidad o sesión): el documento a la izquierda y su
 * evaluación —citas y recomendaciones— a la derecha, con la ficha completa en
 * un modal. Es el mismo bloque que usa el panel del docente y la galería de
 * UGEL, para que ambos vean exactamente lo mismo.
 *
 * `subtitle` añade contexto que el docente no necesita (quién y de qué colegio).
 */
export function ArtifactBlock({ artifact, title, subtitle }: {
  artifact: Artifact
  title: string
  subtitle?: string
}) {
  const [full, setFull] = useState(false)
  const current = latestVersion(artifact)
  const ev = latestEvaluation(artifact)
  const score = ev?.decision === 'MANUAL_REVIEW' ? null : ev?.overall_score
  const valid = isValid(artifact)
  const reason = invalidReason(artifact)

  return (
    <div className={`overflow-hidden rounded-xl border bg-card shadow-xs ${valid ? '' : 'border-warning/40'}`}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {subtitle ? `${subtitle} · ` : ''}{current?.original_filename} · v{artifact.current_version}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ValidityPill valid={valid} />
          <Badge value={artifact.status} label={STATUS_LABEL[artifact.status]} />
        </div>
      </div>

      {!valid && reason && (
        <p className="border-b border-warning/30 bg-warning-muted px-4 py-2 text-xs text-warning-foreground">{reason}</p>
      )}

      <div className="grid lg:grid-cols-2">
        {/* Documento */}
        <div className="border-b lg:border-b-0 lg:border-r">
          <ArtifactPdf versionId={current?.id} filename={current?.original_filename} height="h-96" />
        </div>

        {/* Evaluación: texto evaluado con la recomendación encima */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
            <p className="text-sm font-medium">
              Evaluación {score != null && <span className="font-normal text-muted-foreground">· {score}/100</span>}
            </p>
            {ev && <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setFull(true)}>Ver completa</Button>}
          </div>
          <div className="px-4 py-3 lg:max-h-96 lg:overflow-y-auto">
            {ev ? <EvaluationAnnotations ev={ev} /> : <p className="text-sm text-muted-foreground">Sin evaluación disponible.</p>}
          </div>
        </div>
      </div>

      {full && (
        <Modal title={`Evaluación · ${title}`} onClose={() => setFull(false)}>
          {ev ? <EvaluationView ev={ev} prev={previousEvaluation(artifact)} /> : <p className="text-sm text-muted-foreground">Sin evaluación disponible.</p>}
        </Modal>
      )}
    </div>
  )
}

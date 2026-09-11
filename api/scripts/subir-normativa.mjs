// Sube los documentos normativos de la UGEL 06 al bucket público `normativa`.
//
// Son documentos de difusión oficial (oficios múltiples, fichas y rúbricas de
// monitoreo), sin datos personales: viven en un bucket público para poder
// enlazarlos directamente desde la app —a diferencia de `evidence`, que es
// privado y se sirve con URL firmada—.
//
//   node --env-file=.env scripts/subir-normativa.mjs
//
// Es idempotente: vuelve a subir con upsert y reimprime las URLs públicas.
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'normativa'

// Origen en el repo → ruta en el bucket.
const DOCUMENTOS = [
  {
    archivo: '../../docs/normativa/oficio-multiple-00038-2026-agebre.pdf',
    destino: 'ugel06/oficio-multiple-00038-2026-agebre.pdf',
    tipo: 'application/pdf',
  },
]

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const bucket = (await db.storage.listBuckets()).data?.find(b => b.id === BUCKET)
if (!bucket) {
  const { error } = await db.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ['application/pdf'],
    fileSizeLimit: '20MB',
  })
  if (error) throw new Error(`crear bucket: ${error.message}`)
  console.log(`bucket ${BUCKET} creado (público)`)
} else if (!bucket.public) {
  throw new Error(`el bucket ${BUCKET} existe pero es privado; revísalo antes de continuar`)
}

for (const doc of DOCUMENTOS) {
  const buffer = await readFile(new URL(doc.archivo, import.meta.url))
  const { error } = await db.storage
    .from(BUCKET)
    .upload(doc.destino, buffer, { contentType: doc.tipo, upsert: true })
  if (error) throw new Error(`subir ${doc.destino}: ${error.message}`)

  const { data } = db.storage.from(BUCKET).getPublicUrl(doc.destino)
  const sha = createHash('sha256').update(buffer).digest('hex').slice(0, 12)
  console.log(`${doc.destino} · ${(buffer.length / 1024 / 1024).toFixed(1)} MB · sha256 ${sha}`)
  console.log(`  ${data.publicUrl}`)
}

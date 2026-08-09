// Aplica un archivo .sql contra la base Postgres de Supabase.
// Necesita la cadena de conexión Postgres (el service-role JWT NO ejecuta DDL).
// La conexión directa db.<ref>.supabase.co está deprecada (IPv4): usa el Session pooler.
//   Dashboard → Settings → Database → Connection string → Session pooler (URI, puerto 5432)
//   postgresql://postgres.<ref>:<PASSWORD>@aws-1-<region>.pooler.supabase.com:5432/postgres
// Uso (SUPABASE_DB_URL en .env, o inline):
//   npm run db:migrate -- ../supabase/migrations/002_ugel06_diagnostico.sql
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pg from 'pg'

const here = dirname(fileURLToPath(import.meta.url))
const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
if (!url) {
  console.error('\n✖ Falta SUPABASE_DB_URL (cadena de conexión Postgres).\n')
  process.exit(1)
}
const file = process.argv[2]
if (!file) {
  console.error('\n✖ Indica el archivo .sql a aplicar.\n')
  process.exit(1)
}

const sql = readFileSync(resolve(here, file), 'utf8')
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })

await client.connect()
try {
  await client.query('begin')
  await client.query(sql)
  await client.query('commit')
  console.log(`✔ Migración aplicada: ${file}`)
} catch (e) {
  await client.query('rollback')
  console.error(`✖ Error aplicando la migración (rollback):`, e.message)
  process.exitCode = 1
} finally {
  await client.end()
}

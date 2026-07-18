// Conversión de documentos (PDF/PPTX/XLSX) a Markdown mediante la CLI `markitdown`.
import { execFile } from 'node:child_process'
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)

export async function toMarkdown(buf: Buffer, filename: string) {
  const tmp = join(tmpdir(), `kipu-${Date.now()}${extname(filename)}`)
  await writeFile(tmp, buf)
  try {
    const { stdout } = await exec('markitdown', [tmp], { maxBuffer: 20 * 1024 * 1024, timeout: 60000 })
    return stdout
  } finally {
    unlink(tmp).catch(() => {})
  }
}

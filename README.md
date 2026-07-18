# Kipu — Trazabilidad pedagógica que acompaña

MVP hackathon UGEL: los docentes suben evidencias (PDF/PPTX/XLSX), MarkItDown las convierte, Gemini las evalúa contra rúbricas del CNEB y devuelve retroalimentación accionable. Directores supervisan su institución; UGEL ve métricas agregadas y alertas. Versionamiento inmutable y auditoría.

## URLs producción

- **Web**: https://kipu-one.vercel.app
- **API**: https://kipu-api-production.up.railway.app (Railway, con Python + markitdown)
- **DB/Auth/Storage**: Supabase `yoylrbqqxumdgvgdtviw`

## Credenciales demo (password: `KipuDemo2026!`)

| Rol | Correo |
|---|---|
| Profesora (I.E. 2034) | profesor@kipu.demo |
| Director (I.E. 2034) | director@kipu.demo |
| Especialista UGEL | ugel@kipu.demo |

También: profesor2–4@, director2@ (misma contraseña).

## Guion de demo (5 min)

1. Login **profesor@** → dashboard con sus entregas y estados.
2. Subir un PDF de sesión (tipo "Sesión de clase", clase de hoy) — la ventana horaria valida en el backend (30 min antes → fin de clase).
3. En ~30 s: evaluación de Gemini con puntaje, fortalezas, mejoras y resultado por criterio con evidencia citada. La sesión sin estrategia de retroalimentación queda **Necesita corrección**.
4. "Subir corrección" con la versión mejorada → **Aprobada**, con comparación vs. versión anterior e historial inmutable.
5. Login **director@** → métricas de su institución, tabla de entregas filtrable, alertas, **Descargar Excel**.
6. Login **ugel@** → métricas agregadas por institución, gráfico score/invalidez, grupos con notas bajas, y las 2 alertas (docentes con unidades inválidas consecutivas, grupo 3B con notas bajas). Cambiar el estado de una alerta a **En revisión** (queda auditado por trigger).

PDFs de prueba listos: pedir a Claude regenerar `sesion-v1.pdf` (sin retroalimentación) y `sesion-v2.pdf` (corregida) o usar cualquier sesión real.

## Desarrollo local

```bash
# migración + seed (una vez)
psql "host=aws-1-us-west-2.pooler.supabase.com port=6543 user=postgres.yoylrbqqxumdgvgdtviw dbname=postgres sslmode=require" -f supabase/migrations/001_init.sql
cd api && SUPABASE_SERVICE_ROLE_KEY=... node seed.mjs

# api (requiere markitdown: pip install 'markitdown[pdf,pptx,xlsx]')
cd api && npm i && npm run dev        # :3001

# web
cd web && npm i && npm run dev        # :5173
```

Variables: ver `api/.env.example` y `web/.env.example`. El service role y la key de Gemini nunca llegan al frontend; el web solo usa la anon key con RLS.

## Arquitectura (recortes deliberados de hackathon)

- `web/` Vite + React + TS + Tailwind 4 + TanStack Query + Recharts. Lecturas directas a Supabase con RLS por rol; identidad de marca en `docs/brand.md`.
- `api/` Express + TS. Un solo pipeline síncrono: multer → Supabase Storage (bucket privado `evidence`) → `markitdown` (subproceso Python) → Gemini (`responseSchema` JSON + Zod) → umbrales de decisión → auditoría. Sin worker separado ni cola de jobs.
- Rúbrica versionada en `api/config/rubrics/daily-session.v1.json`.
- Alertas seed + trigger de auditoría en cambios de estado. Export Excel en el cliente (lib `xlsx`).
- Sin tests automatizados (decisión de tiempo); flujo verificado end-to-end contra servicios reales.

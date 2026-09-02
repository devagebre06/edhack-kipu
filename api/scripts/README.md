# scripts/ — poblado de la base de datos (Supabase)

Scripts de mantenimiento para poblar / preparar los datos de Supabase. No forman parte del
servidor: se ejecutan a mano cuando hace falta sembrar datos demo o dar de alta usuarios.

## Requisitos

Las credenciales se leen del entorno. La forma recomendada es pasar el `.env` con
`--env-file` (ya incluido en los scripts de npm). El `.env` debe tener:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # service role: omite RLS, ¡nunca lo expongas al cliente!
```

> ⚠️ Estos scripts usan la **service role key** y escriben directo en producción/demo.
> `seed.mjs` **borra** los datos existentes antes de sembrar.

## Scripts disponibles

| Comando | Archivo | Qué hace |
| --- | --- | --- |
| `npm run db:seed` | `seed.mjs` | Contenido que la data UGEL 06 no trae: periodos ordinarios, **1 especialista UGEL + 1 director** (en el colegio del docente demo), unidades/sesiones/evidencias/evaluaciones de muestra y alertas. Idempotente (borra antes de insertar). Correr **después** de `db:poblacion`. |
| `npm run db:demo-users` | `demo-users.mjs` | Deja **un solo login por rol** (`ugel@`, `director@`, `profesor@kipu.demo`, contraseña `KipuDemo2026!`) y purga las demás cuentas de UGEL/director y las de Auth sin fila en `usuarios`. No toca a los 30 docentes: sostienen los dictados y las tarjetas del panel UGEL. Correr al final. |
| `npm run db:add-user` | `add-user.mjs` | Alta rápida de usuarios demo adicionales (upsert, no borra nada). |
| `npm run db:poblacion` | `poblacion.mjs` | Puebla el **modelo unificado** con la data diagnóstica de UGEL 06 desde `data/ugel06_notas_diagnosticas_primaria.json` (+ contexto sociodemográfico), vía el adapter de ingesta y en orden de FK: ugel → canal → colegio → curso → profesor → aula → dictado → alumno → matrícula → nota. Idempotente (limpia solo lo mapeado por su fuente). |
| `npm run db:generar-notas` | `generar-notas-diagnosticas.mjs` | Regenera `data/ugel06_notas_diagnosticas_primaria.json`: notas sintéticas con el formato de la plantilla real `docs/privado/EV. DIAGNÓSTICA PRIMARIA.xlsx` (acta por aula × área, matemática C1-C4 y comunicación C1-C3, escala C/B/A/AD, consolidado de logros). Determinista: misma semilla → mismo archivo. No toca la DB. |
| `npm run db:migrate -- <archivo.sql>` | `apply-migration.mjs` | Aplica un `.sql` (DDL) contra Postgres. Requiere `SUPABASE_DB_URL` en `.env` con la cadena del **Session pooler** (el service-role JWT no ejecuta DDL). Útil porque no hay `supabase` CLI ni `psql`. La ruta se resuelve desde `scripts/`: pasar **ruta absoluta** (o `../../supabase/migrations/...`). |

También pueden correrse directo:

```bash
node --env-file=.env scripts/seed.mjs
```

Credenciales demo: usuario `*@kipu.demo`, contraseña `KipuDemo2026!`
(configurable con `DEMO_PASSWORD` en el entorno).

## `lib/client.mjs`

Helper compartido por todos los scripts. Evita repetir la URL/credenciales y expone:

- `db` — cliente de Supabase ya autenticado con la service role key.
- `DEMO_PASS` — contraseña demo por defecto.
- `ensureAuthUser(email, password?)` — busca o crea un usuario de Auth y devuelve su `id`.

## Cómo agregar un script nuevo

1. Crea `scripts/mi-script.mjs`.
2. Importa lo que necesites del helper:
   ```js
   import { db, ensureAuthUser } from './lib/client.mjs'
   ```
3. (Opcional) Añade un atajo en `package.json`:
   ```json
   "db:mi-script": "node --env-file=.env scripts/mi-script.mjs"
   ```

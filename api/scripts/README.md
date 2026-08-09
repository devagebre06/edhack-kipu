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
| `npm run db:seed` | `seed.mjs` | Reinicia y siembra el demo completo: instituciones, usuarios, cursos, grupos, horarios, historial de evaluaciones, notas y alertas. Idempotente (borra antes de insertar). |
| `npm run db:add-user` | `add-user.mjs` | Alta rápida de usuarios demo adicionales (upsert, no borra nada). |
| `npm run db:poblacion` | `poblacion.mjs` | Puebla el modelo diagnóstico **UGEL 06** (tablas `ugel06_*`) desde `data/ugel06_60_rubricas_diagnosticas.json` y `data/ugel06_1500_evaluaciones.json`, siguiendo el orden de FK del diagrama. Idempotente. Requiere aplicar antes `supabase/migrations/002_ugel06_diagnostico.sql`. |
| `npm run db:migrate -- <archivo.sql>` | `apply-migration.mjs` | Aplica un `.sql` (DDL) contra Postgres. Requiere `SUPABASE_DB_URL` en `.env` con la cadena del **Session pooler** (el service-role JWT no ejecuta DDL). Útil porque no hay `supabase` CLI ni `psql`. |

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

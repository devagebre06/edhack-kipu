# Web de Kipu

Interfaz de la prueba de concepto construida con React, TypeScript y Vite. La guía general y las direcciones vigentes están en el [README principal](../README.md).

Para iniciarla localmente, crea `web/.env` con las variables de `web/.env.example`, ejecuta `npm ci` y luego `npm run dev` desde esta carpeta. La web necesita una API Kipu y un proyecto Supabase accesibles. `npm run build` comprueba el código y genera `web/dist/`.

La versión pública se construye desde `main` mediante [GitHub Actions](../.github/workflows/deploy-pages.yml). Sus variables `VITE_*` se configuran en el repositorio de GitHub; la clave `SUPABASE_SERVICE_ROLE_KEY` y la clave de Gemini se usan solamente en la API.

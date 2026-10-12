# Kipu - prueba de concepto

Kipu permite que docentes de 4.º de primaria presenten unidades de aprendizaje y sesiones de Matemática o Comunicación. La aplicación extrae el contenido de los archivos, lo revisa con Gemini y devuelve una nota documental y recomendaciones. También muestra información diagnóstica y paneles para dirección y UGEL. Es un **MVP demostrativo**, no una evaluación oficial ni una constatación de lo que ocurrió en el aula.

La información de estudiantes, docentes y desempeño de la demo es sintética. El mapa utiliza ubicaciones reales de colegios; los resultados simulados se muestran solo en una selección de esas ubicaciones.

## Demo vigente

| Componente | Dirección o servicio |
| --- | --- |
| Web | https://devagebre06.github.io/edhack-kipu/ (GitHub Pages) |
| API | https://edhack-kipu-production.up.railway.app (Railway) |
| Base de datos, acceso y archivos | Supabase, en el proyecto administrado por la demo |
| Evaluación de documentos | Google Gemini; modelo principal y respaldo configurables en la API |

La web se publica desde `main` con [GitHub Actions](.github/workflows/deploy-pages.yml). El despliegue de la API se configura en Railway con directorio raíz `/api`. Los dominios, proyectos y claves pueden cambiar durante la transferencia; estas direcciones describen la demo actual.

## Acceso demostrativo

| Rol | Usuario |
| --- | --- |
| Docente | `profesor@kipu.demo` |
| Dirección | `director@kipu.demo` |
| UGEL | `ugel@kipu.demo` |

Contraseña compartida de la **demo sintética**: `KipuDemo2026!`. Está publicada para facilitar la demostración; no se debe usar con información personal real. El administrador receptor deberá decidir cuándo reemplazar estas cuentas y su contraseña.

## Estructura del repositorio

- `web/`: React, TypeScript y Vite; se comunica con Supabase y la API.
- `api/`: Express, conversión de PDF/PPTX/XLSX con MarkItDown y evaluación con Gemini.
- `api/config/prompts/planificacion-4primaria.v1.md`: instrucciones de evaluación vigentes. Ocho criterios de 0 a 3; la nota es la suma convertida a 100 y 75/100 es el mínimo satisfactorio.
- `supabase/`: modelo y migraciones de la base de datos.
- `api/scripts/`: creación y mantenimiento de datos de demostración; algunos scripts sustituyen o eliminan datos y requieren respaldo previo.
- `docs/entrega-poc.md`: comprobaciones para transferir la administración.

La documentación antigua del hackathon se conserva como referencia histórica. Para la configuración actual, empieza por este archivo, `docs/entrega-poc.md` y el código.

## Ejecución local

Se necesita Node.js 22, Python 3 y acceso a un proyecto de Supabase y una clave de Gemini. Las claves se entregan por un canal privado y no están incluidas en Git. **Si se crea un ZIP desde la carpeta local, se deben excluir `.env`, `.git`, `node_modules` y `dist`; descargar el ZIP desde GitHub evita incluir los archivos ignorados.**

1. En `api/`, crear `.env` a partir de `.env.example` y completar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY`. El modelo principal, el de respaldo y `PORT` son configurables.
2. En `web/`, crear `.env` a partir de `.env.example` y completar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_API_BASE_URL`.
3. Instalar dependencias y arrancar cada parte en su propia terminal:

```bash
cd api
npm ci
python -m pip install 'markitdown[pdf,pptx,xlsx]'
npm run dev
```

```bash
cd web
npm ci
npm run dev
```

Por defecto, la API escucha en `http://localhost:3001` y la web en `http://localhost:5173`. Abrir `/health` en la API permite comprobar que responde; la prueba completa requiere iniciar sesión y cargar un documento sintético.

## Comprobación y límites

```bash
cd web && npm run build
```

El resultado de Gemini puede variar entre ejecuciones. El servicio tiene límites de uso y puede devolver errores de cuota o disponibilidad; el modelo de respaldo mejora la continuidad, pero no garantiza evaluaciones ilimitadas. La API procesa cada entrega durante la misma solicitud y no tiene una cola de trabajos. Esta PoC no se entrega como sistema listo para usar con datos reales.

Consulta [la guía de entrega](docs/entrega-poc.md) antes de transferir el repositorio o crear una nueva instancia.

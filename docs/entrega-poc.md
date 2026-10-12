# Entrega de la prueba de concepto Kipu

Esta guía corresponde a la demo de 4.º de primaria publicada en GitHub Pages, Railway, Supabase y Google AI Studio. La entrega transfiere el control del MVP; no supone su puesta en marcha con datos personales reales ni una migración a Laravel/MySQL.

## Qué debe recibir la entidad

1. **Código y facultad de administrarlo:** el repositorio `devagebre06/edhack-kipu`, o una copia completa con historial y permisos de administración. Confirmar con el titular del repositorio original la autorización para transferir la copia modificada. El ZIP del código sirve como respaldo, pero no contiene los servicios ni sus datos. Para evitar incluir claves locales, generarlo desde GitHub o con `git archive`, no comprimiendo sin revisar toda la carpeta de trabajo.
2. **GitHub:** acceso de administración al repositorio y a Pages. Las variables del repositorio para la web son `VITE_API_BASE_URL`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. La acción de publicación está en `.github/workflows/deploy-pages.yml`.
3. **Railway:** acceso de administración al proyecto y servicio de la API, conectado a este repositorio con directorio raíz `/api`; acceso a sus variables y dominio público. La API usa `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` y, si corresponde, `MAX_UPLOAD_SIZE_MB`.
4. **Supabase:** acceso de administración al proyecto, su base Postgres, Auth y el bucket privado `evidence`. Se deben conservar también los datos sintéticos de la demo y sus usuarios de prueba. El esquema SQL y los scripts están en `supabase/` y `api/scripts/`, pero por sí solos no representan una copia de los datos ya cargados.
5. **Google AI Studio:** acceso al proyecto o clave de API utilizada por Gemini y visibilidad de su cuota. La clave va solo en Railway o en el `.env` privado de la API, nunca en la web.
6. **Archivos de prueba:** dos PDF sintéticos de unidad y sesión guardados por separado en `edhack_github/archivos de prueba`; adjuntarlos al paquete de entrega si se desea repetir la demostración.

## Comprobación antes de entregar

- Confirmar que la web pública abre, permite iniciar sesión con los tres roles y muestra información sintética.
- Confirmar que `/health` en la API responde y que una unidad o sesión sintética puede recibir retroalimentación. Esta prueba consume cuota de Gemini.
- Comprobar que el mapa diferencia ubicaciones reales de desempeño simulado.
- Revisar que GitHub Pages, Railway, Supabase y Google AI Studio estén bajo cuentas que la entidad pueda administrar. Las variables y claves se comparten por un canal privado.
- Realizar un respaldo del proyecto de Supabase antes de ejecutar scripts de poblado o limpieza. `db:seed`, `db:demo-users` y `db:solo-4primaria` pueden sustituir o retirar información.
- Verificar los límites y condiciones vigentes de los servicios antes de prometer uso continuo o gratuito. Una cuota agotada puede detener la evaluación de documentos, incluso con el modelo de respaldo.

## Límites actuales

- La calificación de la IA revisa la **planificación escrita**. No acredita lo que se ejecutó en clase ni sustituye una evaluación oficial.
- La regla de la demo es de ocho criterios iguales, de 0 a 3 puntos; 18/24 equivale a 75/100 y basta para una entrega satisfactoria. El archivo vigente es `api/config/prompts/planificacion-4primaria.v1.md`.
- Los datos de estudiantes, notas y desempeño son sintéticos. Las coordenadas de colegios son reales; no se debe interpretar que las donas reflejan resultados reales de esos colegios.
- La contraseña de las cuentas demo está documentada públicamente para facilitar las pruebas. Antes de incorporar datos reales se requerirían nuevas cuentas, rotación de claves y una revisión técnica de seguridad y tratamiento de datos.
- La aplicación actual usa React/Express/Supabase/Gemini. Una migración futura a Laravel/MySQL es un proyecto distinto y no forma parte de esta transferencia.

Para empezar a usar el código, consultar el [README principal](../README.md). Para los comandos de datos, consultar [`api/scripts/README.md`](../api/scripts/README.md).

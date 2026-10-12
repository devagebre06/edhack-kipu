# Activación de Gemini 3.8 Flash en Kipu

El repositorio utiliza `gemini-3.8-flash` como modelo predeterminado. La API lee
`GEMINI_MODEL` del entorno cuando está definido; ese valor tiene prioridad sobre
el predeterminado del código. Si ese modelo devuelve 429, la API prueba el respaldo
de inmediato; ante 503, reintenta primero. El respaldo es `gemini-3.6-flash`.
El modelo que produjo la nota
se guarda en la evaluación. La cuenta y las credenciales no se guardan en Git.

## Pasos fuera del código

1. **Confirmar el proyecto de Google AI Studio.** La persona administradora debe
   verificar que el proyecto y su clave de Gemini API tengan acceso al modelo
   `gemini-3.8-flash`. No hace falta crear otra clave si la actual ya funciona
   con ese modelo. Revisar también los límites de uso y la facturación del
   proyecto para la prueba de concepto.
2. **Configurar la API donde se ejecuta.** En las variables de entorno del
   servicio de API (por ejemplo, Railway), dejar `GEMINI_API_KEY` con la clave
   vigente y establecer `GEMINI_MODEL=gemini-3.8-flash` y
   `GEMINI_FALLBACK_MODEL=gemini-3.6-flash`. Una variable existente
   con `gemini-2.5-flash` anularía el nuevo valor predeterminado del código.
   En una ejecución local, hacer lo mismo en `api/.env`.
3. **Publicar o reiniciar la API con la nueva versión del repositorio.** Cambiar
   una variable en Google AI Studio no actualiza por sí solo el servidor de
   Kipu. La interfaz obtiene el nombre del modelo de la configuración de la API.
4. **Hacer una prueba con datos sintéticos.** Subir una unidad de aprendizaje y
   una sesión de clase legibles; confirmar que ambas reciben ocho puntajes,
   nota final y recomendaciones. Comprobar que la pantalla «Cómo se evalúa»
   muestre `gemini-3.8-flash` como principal y que la evaluación guarde el
   identificador del modelo que realmente la calificó. La prueba del respaldo
   requiere que el principal devuelva 503 o 429; no se debe afirmar que ocurrió si
   ambos intentos no se observaron en los registros.
5. **Revisar los resultados y el consumo.** Comparar el feedback con ejemplos
   ya conocidos, verificar que no aparezcan errores de procesamiento y vigilar
   los límites de uso del proyecto en Google AI Studio.

## Estado de verificación

La compatibilidad del cliente con respuestas de varias partes, salida JSON y
respaldo ante 503 se probó con respuestas simuladas. Con la clave local se
comprobó una solicitud JSON mínima: tanto `gemini-3.8-flash` como
`gemini-3.6-flash` respondieron con estado 200. **La entrega real completa
todavía debe verificarse** desde la interfaz de la demostración.

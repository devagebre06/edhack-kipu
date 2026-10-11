# Activación de Gemini 3.7 Flash en Kipu

El repositorio utiliza `gemini-3.7-flash` como modelo predeterminado. La API lee
`GEMINI_MODEL` del entorno cuando está definido; ese valor tiene prioridad sobre
el predeterminado del código. La cuenta y las credenciales no se guardan en Git.

## Pasos fuera del código

1. **Confirmar el proyecto de Google AI Studio.** La persona administradora debe
   verificar que el proyecto y su clave de Gemini API tengan acceso al modelo
   `gemini-3.7-flash`. No hace falta crear otra clave si la actual ya funciona
   con ese modelo. Revisar también los límites de uso y la facturación del
   proyecto para la prueba de concepto.
2. **Configurar la API donde se ejecuta.** En las variables de entorno del
   servicio de API (por ejemplo, Railway), dejar `GEMINI_API_KEY` con la clave
   vigente y establecer `GEMINI_MODEL=gemini-3.7-flash`. Una variable existente
   con `gemini-2.5-flash` anularía el nuevo valor predeterminado del código.
   En una ejecución local, hacer lo mismo en `api/.env`.
3. **Publicar o reiniciar la API con la nueva versión del repositorio.** Cambiar
   una variable en Google AI Studio no actualiza por sí solo el servidor de
   Kipu. La interfaz obtiene el nombre del modelo de la configuración de la API.
4. **Hacer una prueba con datos sintéticos.** Subir una unidad de aprendizaje y
   una sesión de clase legibles; confirmar que ambas reciben ocho puntajes,
   nota final y recomendaciones. Comprobar que la pantalla «Cómo se evalúa»
   muestre `gemini-3.7-flash` y que la evaluación guarde ese identificador.
5. **Revisar los resultados y el consumo.** Comparar el feedback con ejemplos
   ya conocidos, verificar que no aparezcan errores de procesamiento y vigilar
   los límites de uso del proyecto en Google AI Studio.

## Estado de verificación

La compatibilidad del cliente con respuestas de varias partes y su salida JSON
se probó con respuestas simuladas. **No se ha probado una llamada real a Gemini
3.7 Flash** desde esta copia porque no se dispone aquí de la clave ni del
entorno de despliegue.

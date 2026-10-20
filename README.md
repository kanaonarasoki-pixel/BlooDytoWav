# BlooDytoWav

Web estática sin dependencias de compilación. El conversor, el analizador y el mastering procesan archivos en el navegador; no hay cuentas, API, servidor de aplicación ni base de datos.

## Abrir localmente

1. Abre la carpeta `public` en el Explorador de archivos.
2. Haz doble clic en `index.html`.
3. Elige una herramienta desde el menú o las pestañas.
4. Selecciona un archivo de audio compatible o arrástralo al recuadro.
5. Pulsa el botón de la herramienta para procesar y descargar el resultado.

No hace falta instalar Node.js, npm ni un editor. WAV es el formato de entrada recomendado. El soporte de MP3, FLAC, M4A y otros formatos depende del navegador.

## Funciones

- **Audio a WAV:** conversión local con frecuencia de muestreo configurable y salida mono o estéreo.
- **Key & BPM:** estimación local de tonalidad y tempo. Los resultados pueden variar con pistas complejas o poco rítmicas.
- **Mastering Studio:** ecualización, compresión y nivelado de pico locales; exporta un WAV procesado. No utiliza IA ni envía el audio a terceros.
- El historial solo vive en la pestaña actual; no se persiste ni se recopila información.

Un enlace de YouTube no proporciona la pista de audio. Esta web no descarga audio desde YouTube. Usa un archivo que tengas autorización para procesar.

## Publicar en Render

El archivo `render.yaml` prepara este proyecto como sitio estático. No requiere build, base de datos ni variables de entorno.

1. Crea o conecta un repositorio Git que contenga la carpeta `public` y el archivo `render.yaml` en la raíz.
2. Conecta Render al proveedor Git y crea un **Static Site** o un **Blueprint** usando `render.yaml`.
3. Render publica el contenido de `public/` y despliega automáticamente los cambios de la rama conectada.
4. Usa el subdominio gratuito `onrender.com` que se asigna al sitio. Render gestiona HTTPS/TLS automáticamente.
5. Si se añade un dominio propio más adelante, se configura en Render y en el proveedor DNS; no hace falta comprarlo ahora.

La URL pública no se puede obtener hasta que se conecte una cuenta de hosting y un repositorio. No hay credenciales ni secretos que configurar en esta versión.

## Seguridad y alcance de producción

- La política CSP y los encabezados de seguridad se configuran en `render.yaml`.
- Los archivos permanecen en el dispositivo del visitante; no hay endpoint de subida ni almacenamiento público.
- No hay formularios, autenticación, datos persistentes o API/backend en esta arquitectura; no se añadió una base de datos innecesaria.
- Al ser estática, la reversión se realiza redeplegando un commit anterior desde el proveedor Git.
- Render ofrece hosting estático gratuito con límites de ancho de banda y minutos de despliegue incluidos. Comprueba el uso y las condiciones actuales en tu cuenta antes de abrir el sitio al público.
- Para convertir enlaces de YouTube haría falta un mecanismo permitido que entregue el audio. La API oficial de datos de YouTube no proporciona la descarga de pistas de audio.
- El mastering con IA requiere elegir un proveedor, aceptar sus términos, configurar credenciales de servidor y definir cómo se envía el audio. No se ha fingido esa integración.

## Archivos

- `public/index.html`: contenido y navegación.
- `public/styles.css`: estilos responsive.
- `public/app.js`: selección, análisis, procesamiento y exportación de audio.
- `render.yaml`: definición de hosting y cabeceras.
- `.gitignore`: evita subir secretos o archivos de desarrollo.



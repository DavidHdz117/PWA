# PWA Lab

Demo en español para exponer **Service Worker y Ciclo de Vida**. Usa HTML, CSS, JavaScript y un servidor con Node. No requiere React, Next, Nest ni instalar paquetes para ejecutarla.

## Abrir la aplicación

```powershell
npm start
```

Visita **http://localhost:3000** en Chrome o Edge. No abras `index.html` con doble clic: el service worker requiere localhost o HTTPS. Detén el servidor con `Ctrl + C`.

## Demostración de 5 minutos

1. Abre la app con conexión al servidor y espera **Service worker: Activo**.
2. Guarda una nota. A la derecha verás los archivos reales en caché y el JSON de la nota.
3. Muestra **El código**: manifest, service worker y registro. Los archivos se leen directamente, no son ejemplos separados de la implementación.
4. Abre **F12 → Application → Manifest**, luego **Service workers** y **Cache Storage**. Busca `pwa-lab-archivos-v1` y `pwa-lab-notas-v1`.
5. Ve a **Network → No throttling → Offline**. Mantén DevTools abierto y `Bypass for network` desmarcado en Service workers.
6. Escribe y guarda otra nota sin conexión. El worker intercepta el POST y guarda su JSON en Cache Storage. No hay un servidor de notas.
7. Recarga normalmente con **Ctrl + R**. La app y las notas siguen ahí. Evita **Ctrl + Shift + R**, que puede saltarse el worker. En Network puedes inspeccionar las respuestas del service worker.
8. Vuelve a **No throttling** al terminar. Si DevTools no actualiza Cache Storage automáticamente, pulsa su botón de actualizar.

La pestaña **Guía para exponer** contiene el guion completo y también funciona sin conexión. El indicador de conexión usa `navigator.onLine`: informa del estado que reporta el navegador, no garantiza acceso a internet. La evidencia real es guardar y recargar con la red bloqueada.

## Archivos que debes explicar

| Archivo | Qué hace |
| --- | --- |
| `public/manifest.webmanifest` | Nombre, íconos, colores y forma de abrir la app instalada. JSON no acepta comentarios: cada campo está explicado en la web. |
| `public/register-sw.js` | Registra el worker y espera a que controle la página. |
| `public/service-worker.js` | Comentarios sencillos para `install`, `activate`, `fetch` y guardado de notas. |
| `public/app.js` | Interfaz, peticiones para guardar notas y lectura del contenido real de Cache Storage. |
| `server.js` | Entrega los archivos con Node, sin frameworks. |

## Cómo funciona

- **Registro:** la página llama a `navigator.serviceWorker.register()`.
- **Install:** `cache.addAll()` descarga la estructura de la app. La primera visita necesita acceso al servidor.
- **Activate:** borra versiones anteriores de la caché de archivos y usa `clients.claim()` para controlar la página actual. Conserva las notas.
- **Fetch:** sirve primero los archivos de la caché (*cache first*). Los recursos no incluidos se piden a la red; si falla, responde con estado 503.
- **Notas offline:** `/datos/notas.json` es una ruta virtual atendida por el worker. POST guarda la lista como una respuesta JSON bajo una clave GET en Cache Storage; GET la recupera. El POST en sí no se guarda como petición en caché.
- **Actualización:** normalmente un worker nuevo espera (`waiting`) hasta que se cierran las pestañas controladas por el anterior. En esta demo `skipWaiting()` omite esa espera. El worker anterior puede pasar a `redundant`. `fetch` es un evento, no un estado de instalación.

Las notas son locales a este navegador y origen (incluido el puerto). No se envían a Node, no se sincronizan con un servidor ni entre pestañas; usa una sola pestaña para escribir en esta demo. El navegador puede borrar la caché por limpieza de datos o almacenamiento insuficiente. No es un respaldo permanente.

## Si modificas el código

Cambia `pwa-lab-archivos-v1` por `pwa-lab-archivos-v2` en `service-worker.js` y recarga con conexión. El navegador detectará el worker nuevo y renovará los archivos. Mantén el nombre de la caché de notas para conservarlas. Si editas de nuevo, incrementa la versión otra vez.

Para repetir la primera instalación, ve a **Application → Storage → Clear site data** y recarga con conexión. Esto también borra las notas de la demo.

## Pruebas automáticas (opcionales)

Solo las pruebas requieren dependencias de desarrollo y Chrome instalado:

```powershell
npm install
npm test
```

## Referencias

- [MDN: Uso de service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [MDN: Web app manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)

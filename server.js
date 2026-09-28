// Node solo entrega los archivos. El funcionamiento offline vive en el navegador.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = {
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/styles.css': ['styles.css', 'text/css'],
  '/app.js': ['app.js', 'text/javascript'],
  '/register-sw.js': ['register-sw.js', 'text/javascript'],
  '/service-worker.js': ['service-worker.js', 'text/javascript'],
  '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'],
  '/icon.svg': ['icon.svg', 'image/svg+xml'],
  '/icon-192.png': ['icon-192.png', 'image/png'],
  '/icon-512.png': ['icon-512.png', 'image/png'],
};
const port = Number(process.env.PORT || 3000);

createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = files[path];
  if (!file || request.method !== 'GET') {
    response.writeHead(404).end('No encontrado');
    return;
  }
  try {
    const content = await readFile(new URL(`./public/${file[0]}`, import.meta.url));
    // Desactivamos la caché HTTP para que la demo muestre la del service worker.
    response.writeHead(200, {
      'Content-Type': `${file[1]}${file[1].startsWith('image/') ? '' : '; charset=utf-8'}`,
      'Cache-Control': 'no-store',
    });
    response.end(content);
  } catch (error) {
    console.error(error);
    response.writeHead(500).end('No se pudo leer el archivo');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`\n  PWA Lab → http://localhost:${port}\n  Detener: Ctrl+C\n`);
});

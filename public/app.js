import { registerServiceWorker } from '/register-sw.js';

const $ = (selector) => document.querySelector(selector);
const NOTES_URL = '/datos/notas.json';
let notes = [];
let currentSource = '';
let sourceRequest = 0;

function updateConnection() {
  const offline = !navigator.onLine;
  $('#connection').textContent = offline ? 'Sin conexión' : 'Con conexión';
  $('#connection').classList.toggle('offline', offline);
}
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
updateConnection();

function feedback(message, error = false) {
  $('#feedback').textContent = message;
  $('#feedback').classList.toggle('error', error);
}

// Cambia de sección sin navegar a otra página.
function showView(name) {
  document.querySelectorAll('.view').forEach((view) => {
    view.hidden = view.id !== `view-${name}`;
  });
  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.view === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
}
document.querySelectorAll('[data-view], [data-go]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view || button.dataset.go));
});

// textContent muestra las notas como texto, nunca como HTML ejecutable.
function renderNotes() {
  $('#note-count').textContent = `${notes.length} ${notes.length === 1 ? 'nota' : 'notas'}`;
  if (!notes.length) return;
  $('#notes').replaceChildren();
  [...notes].reverse().forEach((note) => {
    const article = document.createElement('article');
    article.className = 'saved-note';
    const text = document.createElement('p');
    text.textContent = note.text;
    const meta = document.createElement('div');
    meta.className = 'note-meta';
    const date = document.createElement('span');
    date.textContent = new Date(note.date).toLocaleString('es-MX', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
    const mode = document.createElement('span');
    mode.textContent = note.offline ? '✓ Guardada sin conexión' : '✓ Guardada con conexión';
    if (note.offline) mode.className = 'offline-note';
    meta.append(date, mode);
    article.append(text, meta);
    $('#notes').append(article);
  });
}

// Leemos Cache Storage de verdad para que el panel sirva como evidencia.
async function refreshCache() {
  const names = await caches.keys();
  const appCacheName = names.find((name) => name.startsWith('pwa-lab-archivos-'));
  if (appCacheName) {
    const cache = await caches.open(appCacheName);
    const requests = await cache.keys();
    $('#asset-count').textContent = requests.length;
    $('#cache-files').replaceChildren();
    for (const request of requests) {
      const row = document.createElement('div');
      row.className = 'cache-row';
      const resource = document.createElement('code');
      resource.textContent = new URL(request.url).pathname;
      const status = document.createElement('span');
      status.textContent = 'En caché';
      row.append(resource, status);
      $('#cache-files').append(row);
    }
  }
  const dataCache = await caches.open('pwa-lab-notas-v1');
  const response = await dataCache.match(NOTES_URL);
  $('#cached-json').textContent = response
    ? JSON.stringify(await response.json(), null, 2)
    : '[]\n// Guarda una nota para crear /datos/notas.json';
}
$('#refresh-cache').addEventListener('click', () => {
  refreshCache().catch(() => feedback('No se pudo leer Cache Storage.', true));
});
$('#note').addEventListener('input', () => {
  $('#char-count').textContent = `${$('#note').value.length} / 500`;
});

$('#note-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = $('#note').value.trim();
  if (!text) {
    feedback('Escribe algo para guardar tu nota.', true);
    return;
  }
  $('#save-note').disabled = true;
  $('#note').disabled = true;
  try {
    const note = {
      id: crypto.randomUUID(), text, date: new Date().toISOString(), offline: !navigator.onLine,
    };
    // Esta petición la recibe el service worker, incluso estando offline.
    // No llega a Node: el worker guarda el JSON y responde { saved: true }.
    const nextNotes = [...notes, note];
    const response = await fetch(NOTES_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextNotes),
    });
    if (!response.ok) throw new Error('No se pudo guardar en caché.');
    notes = nextNotes;
    renderNotes();
    $('#note').value = '';
    $('#char-count').textContent = '0 / 500';
    feedback(note.offline ? '✓ Nota guardada sin conexión. Recarga: seguirá aquí.' : '✓ Nota guardada en caché. Ahora prueba sin conexión.');
    await refreshCache();
  } catch (error) {
    feedback(`${error.message} Comprueba que el worker esté activo y haya espacio disponible.`, true);
  } finally {
    $('#save-note').disabled = false;
    $('#note').disabled = false;
  }
});

const explanations = {
  'manifest.webmanifest': `<h4>La identidad de la app</h4><p>Es JSON válido. Los comentarios van aquí porque JSON no admite comentarios.</p><ul><li><code>id</code>: identidad de la aplicación.</li><li><code>name / short_name</code>: nombre completo y corto.</li><li><code>description / lang</code>: descripción e idioma.</li><li><code>start_url</code>: página que se abre al iniciar.</li><li><code>scope</code>: rutas que pertenecen a la app.</li><li><code>display: standalone</code>: abre la app instalada en su propia ventana.</li><li><code>background_color / theme_color</code>: colores de inicio e interfaz del navegador.</li><li><code>icons</code>: imágenes para instalar la app.</li></ul><p>El manifest no guarda archivos en caché. Eso lo hace el service worker.</p>`,
  'service-worker.js': `<h4>El intermediario</h4><ul><li><code>install</code>: guarda los archivos antes de usar la app offline.</li><li><code>activate</code>: borra versiones anteriores de los archivos.</li><li><code>fetch</code>: responde con caché antes de intentar la red.</li><li><code>waitUntil()</code>: mantiene vivo el evento hasta terminar la tarea.</li><li><code>respondWith()</code>: entrega nuestra respuesta al navegador.</li><li><code>handleNotes()</code>: guarda o lee el JSON de las notas sin ir al servidor.</li></ul><p>La ruta <code>/datos/notas.json</code> es virtual: la atiende este worker. Cache Storage guarda pares de petición y respuesta.</p><p>Solo los archivos de <code>FILES</code> se precargan. Un recurso desconocido se pide a la red y, si no está disponible, recibe un error 503.</p>`,
  'register-sw.js': `<h4>El punto de partida</h4><p>La página registra el archivo con <code>navigator.serviceWorker.register()</code>.</p><p><code>ready</code> espera a que exista un worker activo. Después se comprueba <code>controller</code> para asegurar que controla esta página antes de guardar notas.</p><p>Este archivo se ejecuta en la página. El service worker se ejecuta en otro contexto, sin acceso directo al DOM.</p>`,
};

// Resaltado sencillo. Los fragmentos del código se insertan siempre como texto.
function renderSource(source) {
  $('#source-code').replaceChildren();
  source.trimEnd().split('\n').forEach((line, index) => {
    const row = document.createElement('span');
    row.className = 'code-line';
    const number = document.createElement('span');
    number.className = 'line-number';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = index + 1;
    row.append(number);
    if (line.trimStart().startsWith('//')) {
      const comment = document.createElement('span');
      comment.className = 'code-comment';
      comment.textContent = line;
      row.append(comment);
    } else {
      const tokens = line.split(/("[^"\n]*"|'[^'\n]*'|\b(?:const|let|await|async|return|if|try|catch|export|function|new|throw)\b)/g);
      for (const token of tokens) {
        const span = document.createElement('span');
        if (/^["']/.test(token)) span.className = 'code-string';
        else if (/^(const|let|await|async|return|if|try|catch|export|function|new|throw)$/.test(token)) span.className = 'code-keyword';
        span.textContent = token;
        row.append(span);
      }
    }
    $('#source-code').append(row);
  });
}

async function loadSource(file) {
  const requestId = ++sourceRequest;
  $('#filename').textContent = file;
  $('#code-explanation').innerHTML = explanations[file]; // Solo texto fijo de este archivo.
  $('#source-code').textContent = 'Cargando…';
  $('#copy-code').disabled = true;
  document.querySelectorAll('.file-button').forEach((button) => {
    const selected = button.dataset.file === file;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  try {
    const response = await fetch(`/${file}`);
    if (!response.ok) throw new Error('No se pudo cargar el archivo.');
    const source = await response.text();
    if (requestId !== sourceRequest) return;
    currentSource = source;
    renderSource(source);
    $('#copy-code').disabled = false;
  } catch (error) {
    if (requestId === sourceRequest) $('#source-code').textContent = error.message;
  }
}
document.querySelectorAll('[data-file]').forEach((button) => {
  button.addEventListener('click', () => loadSource(button.dataset.file));
});
$('#copy-code').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(currentSource);
    $('#copy-code').textContent = '¡Copiado!';
  } catch {
    $('#copy-code').textContent = 'Selecciona y copia el texto';
  }
  setTimeout(() => { $('#copy-code').textContent = 'Copiar código'; }, 2200);
});

async function start() {
  try {
    await registerServiceWorker((state) => {
      const names = { installing: 'Instalando…', installed: 'Instalado', activating: 'Activando…', activated: 'Activado', redundant: 'Reemplazado' };
      $('#worker-state').textContent = names[state] || state;
    });
    $('#worker-dot').classList.add('ready');
    const response = await fetch(NOTES_URL);
    if (!response.ok) throw new Error('No se pudieron recuperar las notas.');
    notes = await response.json();
    renderNotes();
    await refreshCache();
    $('#note').disabled = false;
    $('#save-note').disabled = false;
    feedback('Todo listo. Puedes guardar notas con o sin conexión.');
  } catch (error) {
    $('#worker-state').textContent = 'No disponible';
    feedback(`${error.message} Abre la app en http://localhost:3000.`, true);
  }
  await loadSource('manifest.webmanifest');
}
start();

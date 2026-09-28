// REGISTRO: la página le pide al navegador que instale el service worker.
export async function registerServiceWorker(onState) {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Este navegador no admite service workers. Usa Chrome o Edge.');
  }
  onState('Registrando…');
  const registration = await navigator.serviceWorker.register('/service-worker.js');
  // Permite observar install → installed → activating → activated en pantalla.
  function watch(worker) {
    if (!worker) return;
    const report = () => onState(
      worker.state === 'activated' && navigator.serviceWorker.controller ? 'Activo' : worker.state,
    );
    report();
    worker.addEventListener('statechange', report);
  }
  watch(registration.installing);
  registration.addEventListener('updatefound', () => watch(registration.installing));
  await navigator.serviceWorker.ready;
  // Antes de enviar notas, esperamos a que el worker controle esta página.
  if (!navigator.serviceWorker.controller) {
    await new Promise((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
    });
  }
  onState('Activo');
  return registration;
}

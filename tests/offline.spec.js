import { test, expect } from '@playwright/test';

async function openApp(page) {
  await page.goto('/');
  await expect(page.locator('#worker-state')).toHaveText('Activo');
  await expect(page.locator('#save-note')).toBeEnabled();
}

test('instala el manifest y los recursos completos para funcionar offline', async ({ page }) => {
  await openApp(page);
  const installed = await page.evaluate(async () => {
    const manifest = await (await fetch('/manifest.webmanifest')).json();
    const cache = await caches.open('pwa-lab-archivos-v1');
    const files = (await cache.keys()).map((item) => new URL(item.url).pathname);
    const icons = await Promise.all(manifest.icons.map(async (icon) => {
      const bitmap = await createImageBitmap(await (await fetch(icon.src)).blob());
      return `${bitmap.width}x${bitmap.height}`;
    }));
    return { manifest, files, icons, controlled: !!navigator.serviceWorker.controller };
  });
  expect(installed.controlled).toBe(true);
  expect(installed.manifest.display).toBe('standalone');
  expect(installed.icons).toEqual(['192x192', '512x512']);
  expect(installed.files).toEqual(expect.arrayContaining([
    '/', '/app.js', '/styles.css', '/register-sw.js', '/manifest.webmanifest', '/service-worker.js',
  ]));
  await expect(page.locator('#asset-count')).toHaveText(String(installed.files.length));
});

test('guarda notas offline en Cache Storage y recupera app, notas y código al recargar', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openApp(page);
  await page.locator('#note').fill('Nota con conexión');
  await page.locator('#save-note').click();
  await expect(page.locator('#note-count')).toHaveText('1 nota');

  await context.setOffline(true);
  await expect(page.locator('#connection')).toHaveText('Sin conexión');
  await page.locator('#note').fill('Esta nota se guardó SIN internet');
  await page.locator('#save-note').click();
  await expect(page.locator('#feedback')).toContainText('Nota guardada sin conexión');
  const saved = await page.evaluate(async () => {
    const cache = await caches.open('pwa-lab-notas-v1');
    return (await cache.match('/datos/notas.json')).json();
  });
  expect(saved).toHaveLength(2);
  expect(saved[1]).toMatchObject({ text: 'Esta nota se guardó SIN internet', offline: true });

  await page.reload();
  await expect(page.locator('#worker-state')).toHaveText('Activo');
  await expect(page.locator('#note-count')).toHaveText('2 notas');
  await expect(page.locator('#notes')).toContainText(saved[1].text);
  await expect(page.locator('#cached-json')).toContainText(saved[1].text);
  await page.locator('[data-view="code"]').click();
  await page.locator('[data-file="service-worker.js"]').click();
  await expect(page.locator('#source-code')).toContainText("self.addEventListener('install'");
  await page.locator('[data-file="register-sw.js"]').click();
  await expect(page.locator('#source-code')).toContainText('navigator.serviceWorker.register');
  await page.locator('[data-file="manifest.webmanifest"]').click();
  await expect(page.locator('#source-code')).toContainText('standalone');
  await page.locator('[data-view="guide"]').click();
  await expect(page.getByText('Sin conexión. Con evidencia.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('valida notas vacías y muestra contenido como texto, con diseño móvil sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await page.locator('#note').fill('   ');
  await page.locator('#save-note').click();
  await expect(page.locator('#feedback')).toContainText('Escribe algo');
  await expect(page.locator('#note-count')).toHaveText('0 notas');
  const text = '<img src=x onerror="window.injected=true">';
  await page.locator('#note').fill(text);
  await page.locator('#save-note').click();
  await expect(page.locator('#notes')).toContainText(text);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  for (const view of ['demo', 'code', 'guide']) {
    await page.locator(`[data-view="${view}"]`).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

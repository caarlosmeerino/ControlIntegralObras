// Genera los iconos PNG de la PWA a partir de client/public/icono.svg (requiere Playwright)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
import fs from 'node:fs';
const svg = fs.readFileSync('client/public/icono.svg', 'utf8');
const b = await chromium.launch();
for (const s of [192, 512]) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  await p.setContent(`<html><body style="margin:0;background:#1b1e21">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`);
  await p.screenshot({ path: `client/public/icono-${s}.png`, omitBackground: false });
}
await b.close();

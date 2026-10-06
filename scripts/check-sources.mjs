import fs from 'node:fs/promises';

const data = JSON.parse(await fs.readFile(new URL('../services.json', import.meta.url), 'utf8'));
const normalize = (text) => String(text)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim().toLowerCase();

const fuzzyIncludes = (body, phrase) => {
  const tokens = normalize(phrase).split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) return true;
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(tokens.map(esc).join('.{0,120}?'), 'i').test(body);
};

const cache = new Map();
let failed = false;
for (const service of data.services) {
  let body = cache.get(service.sourceUrl);
  if (!body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(service.sourceUrl, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; StillWaiting/1.2)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-CA,en;q=0.9'
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      body = normalize(await res.text());
      cache.set(service.sourceUrl, body);
    } catch (err) {
      failed = true;
      console.error(`ERROR ${service.id}: ${err.message}`);
      clearTimeout(timer);
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  for (const variant of service.variants) {
    const checks = variant.sourceChecks || service.sourceChecks || [];
    const missing = checks.filter((p) => !fuzzyIncludes(body, p));
    if (missing.length) {
      failed = true;
      console.error(`CHANGE? ${service.id}/${variant.id}: missing ${missing.join(' | ')}`);
    } else {
      console.log(`OK ${service.id}/${variant.id}`);
    }
  }
}
if (failed) process.exit(1);

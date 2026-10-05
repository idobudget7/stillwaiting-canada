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
  return new RegExp(tokens.map(esc).join('.{0,100}?'), 'i').test(body);
};

let failed = false;
for (const service of data.services) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(service.sourceUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StillWaiting/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA,en;q=0.9'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = normalize(await res.text());
    const missing = (service.sourceChecks || []).filter((p) => !fuzzyIncludes(body, p));
    if (missing.length) {
      failed = true;
      console.error(`CHANGE? ${service.id}: missing ${missing.join(' | ')}`);
    } else {
      console.log(`OK ${service.id}`);
    }
  } catch (err) {
    failed = true;
    console.error(`ERROR ${service.id}: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}
if (failed) process.exit(1);

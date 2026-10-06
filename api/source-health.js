const data = require('../services.json');

function normalize(text) {
  return String(text)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function fuzzyIncludes(body, phrase) {
  const tokens = normalize(phrase).split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) return true;
  const pattern = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.{0,120}?');
  return new RegExp(pattern, 'i').test(body);
}

module.exports = async function handler(req, res) {
  const service = data.services.find((item) => item.id === req.query.service);
  if (!service) return res.status(404).json({ status: 'unknown-service' });
  const variant = service.variants.find((item) => item.id === req.query.variant) || service.variants[0];
  if (!variant) return res.status(404).json({ status: 'unknown-variant' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(service.sourceUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StillWaiting/1.2)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA,en;q=0.9'
      }
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    const body = normalize(await response.text());
    const checks = variant.sourceChecks || service.sourceChecks || [];
    const missing = checks.filter((phrase) => !fuzzyIncludes(body, phrase));
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      status: missing.length ? 'changed' : 'verified',
      checkedAt: new Date().toISOString(),
      sourceUrl: service.sourceUrl,
      missingChecks: missing
    });
  } catch (error) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    return res.status(200).json({
      status: 'unavailable',
      checkedAt: new Date().toISOString(),
      sourceUrl: service.sourceUrl
    });
  } finally {
    clearTimeout(timeout);
  }
};

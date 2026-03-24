'use strict';
/**
 * audit.js — High-Performance Hybrid SEO Crawler with Trust Layer & Precision Parser
 */

const puppeteer = require('puppeteer');
const https     = require('https');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const { URL }   = require('url');

// ─── Config ───────────────────────────────────────────────────────────────────
const START_URL   = process.argv[2];
const MAX_PAGES   = parseInt(process.argv[3] || '200', 10);
const CONCURRENCY = 5;

const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const STANDARD_UA  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DATA_DIR    = path.join(__dirname, '../data');
const OUT_FILE    = path.join(DATA_DIR, 'crawl.json');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');
const REPORT_FILE = path.join(DATA_DIR, 'report.json');
const LINKS_FILE  = path.join(DATA_DIR, 'links.json');
const STOP_FILE   = path.join(DATA_DIR, 'stop.flag');
const GSC_FILE    = path.join(DATA_DIR, 'gsc.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let gscData = {};
try { if (fs.existsSync(GSC_FILE)) gscData = JSON.parse(fs.readFileSync(GSC_FILE, 'utf8')); } catch(_) {}

if (!START_URL) {
  console.error('Usage: node audit.js <start-url> [max-pages]');
  process.exit(1);
}

// ─── Atomic Write Helper ──────────────────────────────────────────────────────
function writeJsonAtomic(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function updateStatus(state, step, progress) {
  try { writeJsonAtomic(STATUS_FILE, { state, step, progress }); } catch (_) {}
}

function shouldStop() { return fs.existsSync(STOP_FILE); }

function isBlockedPath(urlStr) {
  const BLOCKED = ['/auth', '/login', '/cart', '/checkout', '/account', 'redirect', '/wp-admin'];
  try {
    const { pathname } = new URL(urlStr);
    return BLOCKED.some(b => pathname.includes(b));
  } catch (_) { return true; }
}

function normalizeUrl(raw, base) {
  try {
    const u = new URL(raw, base);
    u.hash = '';
    if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    return u.href;
  } catch (_) { return null; }
}

// ─── SEO Analysis Suite ────────────────────────────────────────────────────────
const IMPACT_WEIGHTS = {
  'Missing title': 10, 'Status != 200': 10, 'Missing meta description': 8,
  'No H1': 7, 'noindex page': 7, 'Thin content (<300 words)': 5,
  'Title too long (>60 chars)': 3, 'Meta too long (>160 chars)': 3,
  'Multiple H1': 2, 'Canonical mismatch': 4, 'Missing canonical': 2
};

function generateAIFix(issue, data) {
  const topic = data.title || (data.url.split('/').pop() || 'Content');
  switch (issue) {
    case 'Missing title':              return `${topic} | Expert SEO Solutions`;
    case 'Missing meta description':   return `Explore our ${topic.toLowerCase()} — expert insights for growth.`;
    case 'No H1':                      return `Complete Overview of ${topic}`;
    case 'Thin content (<300 words)':  return 'Expand with 2+ paragraphs covering key services.';
    case 'Missing canonical':          return data.url;
    default:                           return 'Update tags to follow SEO best practices.';
  }
}

function analyzeSEO(data) {
  const allIssues = [];
  const check = (name, isError) => ({
    issue: name, severity: IMPACT_WEIGHTS[name] >= 7 ? 'High' : 'Low', 
    weight: IMPACT_WEIGHTS[name], fix: generateAIFix(name, data), recommendation: 'Check tags'
  });

  if (!data.title)        allIssues.push(check('Missing title'));
  if (!data.meta)         allIssues.push(check('Missing meta description'));
  if (data.h1Count === 0) allIssues.push(check('No H1'));
  if (data.status !== 200 && data.status > 0) allIssues.push(check('Status != 200'));
  if (data.noindex)       allIssues.push(check('noindex page'));
  if (data.canonical && data.canonical !== data.url) allIssues.push(check('Canonical mismatch'));

  return {
    errors: allIssues.filter(i => i.weight >= 7),
    warnings: allIssues.filter(i => i.weight < 7)
  };
}

// ─── Precision Parser (Cleanup + DOM logic) ────────────────────────────────────
function cleanHTML(html) {
  if (!html) return '';
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
}

function parseSEOSignals(html, headers) {
  const cleaned = cleanHTML(html);
  const xRobots = (headers['x-robots-tag'] || '').toLowerCase();
  const gBotMatch = cleaned.match(/<meta[^>]+name=["']googlebot["'][^>]+content=["']([^"']+)["']/i);
  const gBotVal = gBotMatch ? gBotMatch[1].toLowerCase() : null;
  const robotsMatch = cleaned.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
  const robotsVal = robotsMatch ? robotsMatch[1].toLowerCase() : null;

  let robots_tag = 'NOT FOUND', source = 'none', confidence = 50, notes = '';
  if (gBotVal) { robots_tag = gBotVal.includes('noindex') ? 'NOINDEX' : 'INDEXABLE'; source = 'googlebot meta'; confidence = 100; }
  else if (xRobots) { robots_tag = xRobots.includes('noindex') ? 'NOINDEX' : 'INDEXABLE'; source = 'header'; confidence = 95; }
  else if (robotsVal) { robots_tag = robotsVal.includes('noindex') ? 'NOINDEX' : 'INDEXABLE'; source = 'meta tag'; confidence = 85; }
  else { robots_tag = 'INDEXABLE'; }

  return { robots_tag, source, valid: true, confidence_score: `${confidence}%`, notes };
}

// ─── Flexible Fetch ────────────────────────────────────────────────────────────
function fetchRaw(url, options = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const method = options.method || 'GET';
    const ua = options.ua || STANDARD_UA;
    const timer = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    const req = mod.request(url, { method, headers: { 'User-Agent': ua, Accept: 'text/html' } }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        clearTimeout(timer); return resolve({ status: res.statusCode, html: '', redirected: true, location: res.headers.location, headers: res.headers });
      }
      let body = '';
      res.on('data', chunk => { body += chunk; if (body.length > 500000) req.destroy(); });
      res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, html: body, headers: res.headers }); });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.end();
  });
}

/** Advanced Validation Pipeline */
async function validateIndexing(url, incomingCount = 0) {
  try {
    const [standard, googlebot, headersOnly] = await Promise.all([
      fetchRaw(url, { ua: STANDARD_UA }),
      fetchRaw(url, { ua: GOOGLEBOT_UA }),
      fetchRaw(url, { method: 'HEAD' })
    ]);
    const finalRes = parseSEOSignals(googlebot.html, googlebot.headers);
    const isFresh = headersOnly.headers['last-modified'] ? (Date.now() - new Date(headersOnly.headers['last-modified']).getTime() < 7*24*60*60*1000) : false;
    const isGSCIndexed = gscData[url]?.status === 'indexed';

    if (isGSCIndexed) return { url, issue: 'None', severity: 'Info', confidence_score: '100%', final_verdict: 'GOOGLE OVERRIDDEN', isGoogleVerified: true };

    let verdict = 'VALID ISSUE', severity = finalRes.robots_tag === 'NOINDEX' ? 'High' : 'Low';
    if (finalRes.robots_tag === 'NOINDEX') {
      if (incomingCount > 5) { verdict = 'LIKELY FALSE POSITIVE'; severity = 'Medium'; }
      if (isFresh) verdict = 'NEEDS MANUAL REVIEW';
    }
    return { url, issue: finalRes.robots_tag === 'NOINDEX' ? 'Explicit NOINDEX' : 'None', severity, confidence_score: finalRes.confidence_score, signals: finalRes, final_verdict: verdict, isFresh, isLikelyIndexedInSERP: incomingCount > 5 };
  } catch(e) { return { url, issue: 'None', severity: 'Info', final_verdict: 'NEEDS MANUAL REVIEW' }; }
}

async function extractFromBrowser(page, url) {
  await page.setRequestInterception(true);
  page.on('request', r => { if (['image', 'font'].includes(r.resourceType())) r.abort(); else r.continue(); });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const data = await page.evaluate(() => {
    const robots = document.querySelector('meta[name="robots"]')?.content.toLowerCase() || '';
    const google = document.querySelector('meta[name="googlebot"]')?.content.toLowerCase() || '';
    return {
      title: document.title, meta: document.querySelector('meta[name="description"]')?.content || '',
      h1Count: document.querySelectorAll('h1').length, canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      noindex: robots.includes('noindex') || google.includes('noindex'),
      wordCount: document.body.innerText.split(/\s+/).length,
      links: Array.from(document.querySelectorAll('a[href]')).map(a => ({ href: a.href, anchor: a.innerText }))
    };
  });
  return { ...data, status: response ? response.status() : 0 };
}

// ─── Main Logic ───────────────────────────────────────────────────────────────
async function runAudit() {
  const startUrlObj = new URL(START_URL);
  const baseOrigin = startUrlObj.origin;
  const queue = [normalizeUrl(START_URL, START_URL)];
  const visited = new Set();
  const results = [];
  const linkMap = [];
  let crawled = 0;

  try { if (fs.existsSync(STOP_FILE)) fs.unlinkSync(STOP_FILE); } catch(_){}
  updateStatus('running', 'Launching crawler…', 2);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  const processUrl = async (url) => {
    if (!url || visited.has(url) || !url.startsWith(baseOrigin) || isBlockedPath(url)) return;
    visited.add(url); crawled++;

    const totalEstimated = Math.max(visited.size + queue.length, crawled);
    const progress = Math.min(99, Math.round((crawled / totalEstimated) * 100));
    updateStatus('running', `Crawling ${crawled}/${totalEstimated}: ${url}`, progress);

    let pageData;
    try {
      const raw = await fetchRaw(url);
      if (raw.html.length < 500) {
        const page = await browser.newPage();
        try { pageData = await extractFromBrowser(page, url); } finally { await page.close(); }
      } else {
        const get = (pat) => { const m = cleanHTML(raw.html).match(pat); return m ? m[1].trim() : ''; };
        pageData = {
          title: get(/<title[^>]*>([^<]+)<\/title>/i),
          meta: get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i),
          h1Count: (cleanHTML(raw.html).match(/<h1[\s>]/gi) || []).length,
          canonical: get(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i),
          noindex: false, status: raw.status,
          wordCount: cleanHTML(raw.html).replace(/<[^>]+>/g, ' ').split(/\s+/).length,
          links: [...cleanHTML(raw.html).matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => ({ href: m[1], anchor: m[2].replace(/<[^>]+>/g, '').trim() }))
        };
      }
    } catch(e) { return; }

    if (!pageData) return;
    pageData.links.forEach(l => {
      const norm = normalizeUrl(l.href, url);
      if (norm && norm.startsWith(baseOrigin)) {
        if (!visited.has(norm) && !queue.includes(norm) && crawled + queue.length < MAX_PAGES) queue.push(norm);
        linkMap.push({ source: url, target: norm, anchor: l.anchor, type: 'internal' });
      } else if (norm) {
        linkMap.push({ source: url, target: norm, anchor: l.anchor, type: 'external' });
      }
    });

    const { errors, warnings } = analyzeSEO({ ...pageData, url });
    results.push({ url, status: pageData.status, wordCount: pageData.wordCount, internalLinks: linkMap.filter(l => l.source === url && l.type === 'internal').length, externalLinks: linkMap.filter(l => l.source === url && l.type === 'external').length, issues: { errors, warnings } });
    
    if (results.length % 5 === 0) {
      writeJsonAtomic(OUT_FILE, results);
      // Also sync links.json periodically
      const linksSnapshot = results.map(r => {
        const incoming = linkMap.filter(l => l.target === r.url);
        const outgoing = linkMap.filter(l => l.source === r.url);
        const external = outgoing.filter(l => l.type === 'external');
        const linkIssues = [];
        if (incoming.length === 0) linkIssues.push('Orphan Page');
        if (incoming.length < 2) linkIssues.push('Weak Internal Authority');

        return { 
          url: r.url, internalCount: r.internalLinks, externalCount: external.length, 
          incomingCount: incoming.length, indexingValidation: r.indexingValidation, 
          incomingLinks: incoming, outgoingLinks: outgoing, externalLinks: external, linkIssues
        };
      });
      writeJsonAtomic(LINKS_FILE, linksSnapshot);
    }
  };

  const runWorker = async () => {
    while (crawled < MAX_PAGES && !shouldStop() && queue.length > 0) {
      const url = queue.shift();
      if (!url) break;
      await processUrl(url);
      const incoming = linkMap.filter(l => l.target === url).length;
      const indexingResults = await validateIndexing(url, incoming);
      const resIdx = results.findIndex(r => r.url === url);
      if (resIdx !== -1) {
        results[resIdx].indexingValidation = indexingResults;
        if (indexingResults.issue !== 'None') results[resIdx].issues.errors.push({ issue: indexingResults.issue, severity: indexingResults.severity, why: indexingResults.explanation, fix: 'Check tags', verdict: indexingResults.final_verdict });
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => runWorker()));
  await browser.close();

  writeJsonAtomic(OUT_FILE, results);
  const totalIssues = results.reduce((a, r) => a + r.issues.errors.length + r.issues.warnings.length, 0);
  const siteHealth = results.length > 0 ? Math.max(0, 100 - Math.floor(totalIssues / results.length * 5)) : 0;
  writeJsonAtomic(REPORT_FILE, { siteHealth, totalIssues, indexing: { noindexFound: results.filter(r => r.indexingValidation?.severity === 'High').length, mismatches: results.filter(r => r.indexingValidation?.issue === 'CRAWLER MISMATCH').length, verified: results.filter(r => r.indexingValidation?.isGoogleVerified).length } });
  writeJsonAtomic(LINKS_FILE, results.map(r => {
    const incoming = linkMap.filter(l => l.target === r.url);
    const outgoing = linkMap.filter(l => l.source === r.url);
    const external = outgoing.filter(l => l.type === 'external');
    const linkIssues = [];
    if (incoming.length === 0) linkIssues.push('Orphan Page');
    if (incoming.length < 2) linkIssues.push('Weak Internal Authority');
    
    return { 
      url: r.url, 
      internalCount: r.internalLinks, 
      externalCount: external.length,
      incomingCount: incoming.length, 
      indexingValidation: r.indexingValidation, 
      incomingLinks: incoming, 
      outgoingLinks: outgoing,
      externalLinks: external,
      linkIssues: linkIssues
    };
  }));
  updateStatus('completed', 'Done', 100);
}

runAudit().catch(e => { console.error(e); updateStatus('error', e.message, 0); });

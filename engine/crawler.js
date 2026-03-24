'use strict';

/**
 * SEO Crawler
 * Usage: node crawler.js <start-url> [max-pages]
 * Example: node crawler.js https://example.com 200
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const START_URL  = process.argv[2];
const MAX_PAGES  = parseInt(process.argv[3] || '500', 10);
const CONCURRENCY = 15;          // parallel requests
const REQUEST_TIMEOUT = 15000;   // ms
const JSON_OUTPUT_FILE = path.join(__dirname, '..', 'data', 'crawl.json');

if (!START_URL) {
  console.error('Usage: node crawler.js <start-url> [max-pages]');
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Normalise a URL: strip hash, trailing slash, enforce https where applicable.
 */
function normalise(rawUrl, base) {
  try {
    const u = new URL(rawUrl, base);
    u.hash = '';                        // drop fragments
    // strip trailing slash (except root)
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Return true if the URL belongs to the same origin as the start URL.
 */
function isInternal(url, origin) {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

/**
 * Count words in visible text (rough but good enough for SEO purposes).
 */
function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Extract all SEO fields from an HTML page.
 */
function extractData(html, pageUrl, origin) {
  const $ = cheerio.load(html);

  // Remove non-visible elements
  $('script, style, noscript, head').remove();

  const title           = $('head title').text().trim() ||
                          $('title').first().text().trim();          // fallback
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() ?? '';
  const h1              = $('h1').first().text().replace(/\s+/g, ' ').trim();
  const h2s             = $('h2').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().join(' | ');
  const canonical       = $('link[rel="canonical"]').attr('href')?.trim() ?? '';
  const bodyText        = $.root().text();
  const wordCount       = countWords(bodyText);

  // Images
  const allImages       = $('img');
  const imageCount      = allImages.length;
  const imagesMissingAlt = allImages.filter((_, el) => !$(el).attr('alt')).length;

  // Links
  let internalLinks = 0;
  let externalLinks = 0;
  const discoveredInternal = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href').trim();
    const abs  = normalise(href, pageUrl);
    if (!abs) return;

    if (isInternal(abs, origin)) {
      internalLinks++;
      discoveredInternal.add(abs);
    } else {
      // skip mailto / tel / javascript schemes counted as external
      try {
        const scheme = new URL(abs).protocol;
        if (!['mailto:', 'tel:', 'javascript:'].includes(scheme)) externalLinks++;
      } catch { /* ignore */ }
    }
  });

  return {
    title,
    metaDescription,
    h1,
    h2s,
    canonical,
    wordCount,
    imageCount,
    imagesMissingAlt,
    internalLinks,
    externalLinks,
    discoveredInternal,
  };
}

// ─── Crawler core ─────────────────────────────────────────────────────────────
async function fetchPage(url) {
  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT,
    maxRedirects: 5,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; SEO-Crawler/1.0; +https://github.com/seo-engine)',
      Accept: 'text/html,application/xhtml+xml',
    },
    // Capture the final URL after redirects
    validateStatus: () => true,   // don't throw on 4xx/5xx
  });
  return response;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function crawl() {
  const baseUrl   = new URL(START_URL);
  const origin    = baseUrl.origin;
  const startHref = normalise(START_URL, START_URL);

  const visited  = new Set();   // URLs already crawled (or in-flight)
  const inFlight = new Set();   // URLs currently being fetched
  const queue    = [startHref]; // BFS queue
  const results  = [];

  let crawled = 0;

  console.log(`\n🕷  Starting crawl: ${origin}`);
  console.log(`   Max pages : ${MAX_PAGES}`);
  console.log(`   Concurrency: ${CONCURRENCY}\n`);

  /**
   * One worker: loops until queue is empty AND no other workers are active.
   */
  async function worker() {
    while (queue.length > 0 && crawled < MAX_PAGES) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;

      visited.add(url);
      inFlight.add(url); // Keep inFlight for tracking active requests
      crawled++;

      const row = {
        url,
        statusCode: null,
        title: '',
        metaDescription: '',
        h1: '',
        h2s: '',
        canonical: '',
        wordCount: 0,
        imageCount: 0,
        imagesMissingAlt: 0,
        internalLinks: 0,
        externalLinks: 0,
        error: null,
      };
      try {
        const res = await fetchPage(url);
        row.statusCode = res.status;

        const contentType = res.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
          const data = extractData(res.data, url, origin);
          Object.assign(row, {
            title:            data.title,
            metaDescription:  data.metaDescription,
            h1:               data.h1,
            h2s:              data.h2s,
            canonical:        data.canonical,
            wordCount:        data.wordCount,
            imageCount:       data.imageCount,
            imagesMissingAlt: data.imagesMissingAlt,
            internalLinks:    data.internalLinks,
            externalLinks:    data.externalLinks,
          });

          // Enqueue newly discovered internal URLs
          for (const link of data.discoveredInternal) {
            if (!visited.has(link) && !queue.includes(link)) {
              queue.push(link);
            }
          }
        }

        const statusIcon = res.status < 300 ? '✅' : res.status < 400 ? '↪ ' : '❌';
        console.log(`${statusIcon} [${crawled}/${MAX_PAGES}] ${res.status}  ${url}`);
      } catch (err) {
        row.error = err.message;
        row.statusCode = err.response?.status ?? 'ERR';
        console.log(`⚠️  [${crawled}/${MAX_PAGES}] ERR  ${url}  — ${err.message}`);
      } finally {
        inFlight.delete(url);
      }

      results.push(row);

      // Incremental save every 5 pages
      if (results.length % 5 === 0) {
        fs.writeFileSync(JSON_OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
      }
    }
  }

  // Spin up N workers in parallel
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // Final saves
  fs.writeFileSync(JSON_OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');

  console.log(`\n✅ Crawl complete!`);
  console.log(`   Pages crawled : ${results.length}`);
  console.log(`   JSON output   : ${JSON_OUTPUT_FILE}\n`);
}

crawl().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

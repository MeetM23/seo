'use strict';

/**
 * CWV Report Generator
 * Reads crawl-output.csv → calls PageSpeed Insights API → writes cwv-report.csv
 *
 * Usage:
 *   node cwv-report.js <API_KEY> [strategy]
 *   node cwv-report.js AIza... mobile
 *   node cwv-report.js AIza... desktop
 *
 * Strategy defaults to "mobile" (Google's primary ranking signal).
 */

const fs       = require('fs');
const path     = require('path');
const axios    = require('axios');

// ─── Config ──────────────────────────────────────────────────────────────────
const API_KEY      = process.argv[2] || 'AIzaSyAq1TXph15YXDNEJhj-7Sht5o09LkOpRAw';
const STRATEGY     = (process.argv[3] || 'mobile').toUpperCase(); // MOBILE | DESKTOP
const INPUT_FILE       = path.join(__dirname, '..', 'data', 'crawl.json');
const JSON_OUTPUT_FILE = path.join(__dirname, '..', 'data', 'cwv.json');
const CONCURRENCY  = 3;     // PSI API has strict rate limits – keep low
const RETRY_LIMIT  = 2;
const RETRY_DELAY  = 2000;  // ms between retries

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

if (!API_KEY) {
  console.error('\n❌  Usage: node cwv-report.js <YOUR_API_KEY> [mobile|desktop]\n');
  process.exit(1);
}

if (!fs.existsSync(INPUT_FILE)) {
  console.error(`\n❌  "${INPUT_FILE}" not found. Run crawler.js first.\n`);
  process.exit(1);
}

// ─── Tagging helpers ─────────────────────────────────────────────────────────
function tagLCP(seconds) {
  if (seconds === null) return 'N/A';
  if (seconds > 4)    return 'Critical';
  if (seconds > 2.5)  return 'High';
  if (seconds > 0)    return 'Good';
  return 'N/A';
}

function tagCLS(value) {
  if (value === null) return 'N/A';
  if (value > 0.25)   return 'Critical';
  if (value > 0.1)    return 'High';
  return 'Good';
}

function tagFID(ms) {
  if (ms === null)  return 'N/A';
  if (ms > 300)     return 'Critical';
  if (ms > 100)     return 'High';
  return 'Good';
}

function tagTTFB(ms) {
  if (ms === null)  return 'N/A';
  if (ms > 1800)    return 'Critical';
  if (ms > 800)     return 'High';
  return 'Good';
}

// ─── PSI API call ─────────────────────────────────────────────────────────────
/**
 * Safely read a numeric audit value from the PSI response.
 */
function auditValue(audits, id) {
  return audits?.[id]?.numericValue ?? null;
}

async function fetchPSI(url, attempt = 1) {
  try {
    const res = await axios.get(PSI_ENDPOINT, {
      params: {
        url,
        key: API_KEY,
        strategy: STRATEGY,
        // Request only the categories we need to speed up the response
        category: ['performance'],
      },
      timeout: 30000,
    });

    const data       = res.data;
    const categories = data.lighthouseResult?.categories;
    const audits     = data.lighthouseResult?.audits;

    const performanceScore = Math.round((categories?.performance?.score ?? 0) * 100);

    // Core metrics – prefer field data (loadingExperience) then lab data
    const fieldMetrics = data.loadingExperience?.metrics || {};

    const lcpRaw  = fieldMetrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile
                    ?? auditValue(audits, 'largest-contentful-paint');
    const clsRaw  = fieldMetrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
                    ?? auditValue(audits, 'cumulative-layout-shift');
    // INP replaces FID in newer PSI; fall back gracefully
    const fidRaw  = fieldMetrics?.INTERACTION_TO_NEXT_PAINT?.percentile
                    ?? fieldMetrics?.FIRST_INPUT_DELAY_MS?.percentile
                    ?? auditValue(audits, 'interactive');            // TTI as proxy
    const ttfbRaw = fieldMetrics?.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile
                    ?? auditValue(audits, 'server-response-time');

    // Lab-only extras
    const fcpRaw        = auditValue(audits, 'first-contentful-paint');
    const tbtRaw        = auditValue(audits, 'total-blocking-time');
    const speedIndexRaw = auditValue(audits, 'speed-index');

    // Normalise units
    const lcp        = lcpRaw  != null ? +(lcpRaw / 1000).toFixed(2)     : null;
    const cls        = clsRaw  != null ? +(clsRaw / 100).toFixed(3)      : clsRaw ?? null;
    const fid        = fidRaw  != null ? Math.round(fidRaw)               : null;
    const ttfb       = ttfbRaw != null ? Math.round(ttfbRaw)             : null;
    const fcp        = fcpRaw  != null ? +(fcpRaw / 1000).toFixed(2)     : null;
    const tbt        = tbtRaw  != null ? Math.round(tbtRaw)              : null;
    const speedIndex = speedIndexRaw != null
                       ? +(speedIndexRaw / 1000).toFixed(2) : null;

    // Handle CLS – sometimes already a decimal, sometimes a percentile integer
    // If cls > 2, it's likely a percentile that needs /100
    const clsNorm = cls != null && cls > 2 ? +(cls / 100).toFixed(3) : cls;

    return {
      url,
      strategy:         STRATEGY,
      performanceScore,
      lcp:              lcp        ?? 'N/A',
      lcpTag:           tagLCP(lcp),
      cls:              clsNorm    ?? 'N/A',
      clsTag:           tagCLS(clsNorm),
      fid:              fid        ?? 'N/A',
      fidTag:           tagFID(fid),
      ttfb:             ttfb       ?? 'N/A',
      ttfbTag:          tagTTFB(ttfb),
      fcp:              fcp        ?? 'N/A',
      tbt:              tbt        ?? 'N/A',
      speedIndex:       speedIndex ?? 'N/A',
      error: '',
    };

  } catch (err) {
    const status = err.response?.status;

    // 429 Too Many Requests – back off and retry
    if (status === 429 && attempt <= RETRY_LIMIT) {
      const wait = RETRY_DELAY * attempt;
      console.log(`   ⏳ Rate-limited. Waiting ${wait}ms before retry ${attempt}/${RETRY_LIMIT}…`);
      await sleep(wait);
      return fetchPSI(url, attempt + 1);
    }

    const message = err.response?.data?.error?.message ?? err.message;
    return {
      url, strategy: STRATEGY,
      performanceScore: 'ERR', lcp: 'ERR', lcpTag: 'ERR',
      cls: 'ERR', clsTag: 'ERR', fid: 'ERR', fidTag: 'ERR',
      ttfb: 'ERR', ttfbTag: 'ERR', fcp: 'ERR', tbt: 'ERR',
      speedIndex: 'ERR', error: message,
    };
  }
}

// ─── Concurrency helper ───────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function processQueue(urls) {
  const results = new Array(urls.length);
  let idx = 0;

  async function worker() {
    while (idx < urls.length) {
      const i   = idx++;
      const url = urls[i];
      process.stdout.write(`📡 [${i + 1}/${urls.length}] ${url} … `);
      const row = await fetchPSI(url);
      const scoreLabel = typeof row.performanceScore === 'number'
        ? `Score: ${row.performanceScore}  LCP: ${row.lcp}s  CLS: ${row.cls}  TTFB: ${row.ttfb}ms`
        : `ERROR: ${row.error}`;
      console.log(scoreLabel);
      results[i] = row;

      // Incremental save every 5 URLs
      if ((i + 1) % 5 === 0) {
        fs.writeFileSync(JSON_OUTPUT_FILE, JSON.stringify(results.filter(r => r !== undefined), null, 2), 'utf8');
      }

      // Small polite delay between requests
      await sleep(500);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Read and parse crawl-output.json
  const rows = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

  // Filter to successful pages only (status 200), deduplicate URLs
  const seen = new Set();
  const urls = rows
    .filter(r => {
      const code = parseInt(r.statusCode, 10);
      return code >= 200 && code < 300;
    })
    .map(r => r.url)
    .filter(url => {
      if (seen.has(url)) return false;
      seen.add(url);
      return !!url;
    })
    .slice(0, 15); // Cap at 15 URLs to prevent 40+ minute API wait times

  if (urls.length === 0) {
    console.error(`\n❌  No successful URLs found in "${INPUT_FILE}".\n`);
    process.exit(1);
  }

  console.log(`\n🚀  PageSpeed Insights CWV Report`);
  console.log(`   Input  : ${INPUT_FILE} (${urls.length} URLs)`);
  console.log(`   Strategy: ${STRATEGY}\n`);

  const results = await processQueue(urls);

  // Final save
  fs.writeFileSync(JSON_OUTPUT_FILE, JSON.stringify(results.filter(r => r !== undefined), null, 2), 'utf8');

  // Print summary
  const successes = results.filter(r => r.error === '');
  const errors    = results.filter(r => r.error !== '');
  const criticals = successes.filter(r => r.lcpTag === 'Critical');
  const highs     = successes.filter(r => r.lcpTag === 'High');

  console.log('\n─────────────────────────────────────────');
  console.log('📊  Summary');
  console.log(`   Total URLs     : ${results.length}`);
  console.log(`   Successful     : ${successes.length}`);
  console.log(`   Errors         : ${errors.length}`);
  console.log(`   LCP Critical   : ${criticals.length}  (> 4s)`);
  console.log(`   LCP High       : ${highs.length}  (2.5–4s)`);
  console.log(`   JSON output    : ${JSON_OUTPUT_FILE}`);
  console.log('─────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

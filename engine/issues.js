'use strict';

/**
 * SEO Issue Analyzer
 * Reads crawl-output.csv produced by crawler.js and detects common SEO issues.
 *
 * Usage: node seo-issues.js [input-csv]
 * Default input: crawl-output.csv
 * Output: issues.csv
 */

const fs   = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const INPUT_FILE       = path.join(__dirname, '..', 'data', 'crawl.json');
const JSON_OUTPUT_FILE = path.join(__dirname, '..', 'data', 'issues.json');

if (!fs.existsSync(INPUT_FILE)) {
  console.error(`\n❌  "${INPUT_FILE}" not found. Run crawler.js first.\n`);
  process.exit(1);
}

// ─── Issue builder ────────────────────────────────────────────────────────────
function issue(url, issueName, detail, severity, recommendation) {
  return { url, issue: issueName, detail, severity, recommendation };
}

// Severity levels: Critical > High > Medium > Low
const SEV = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

// ─── Rules ────────────────────────────────────────────────────────────────────

/** 1. Broken links – 4xx / 5xx status codes */
function checkBrokenLinks(rows) {
  const issues = [];
  for (const r of rows) {
    const code = parseInt(r.statusCode, 10);
    if (isNaN(code)) continue;
    if (code >= 400 && code < 500) {
      issues.push(issue(
        r.url,
        'Broken Link (4xx)',
        `HTTP ${code}`,
        code === 404 ? SEV.critical : SEV.high,
        code === 404
          ? 'Remove or redirect this URL to the correct page (301 redirect).'
          : `Investigate HTTP ${code} error and fix server-side or access issue.`,
      ));
    } else if (code >= 500) {
      issues.push(issue(
        r.url,
        'Server Error (5xx)',
        `HTTP ${code}`,
        SEV.critical,
        'Fix the server-side error. These pages are not indexed by search engines.',
      ));
    }
  }
  return issues;
}

/** 2. Redirect chains – 3xx responses crawled (crawler follows redirects but logs intermediates) */
function checkRedirects(rows) {
  const issues = [];
  for (const r of rows) {
    const code = parseInt(r.statusCode, 10);
    if (code >= 300 && code < 400) {
      issues.push(issue(
        r.url,
        'Redirect Detected',
        `HTTP ${code}`,
        SEV.medium,
        'Update all internal links and canonical tags to point directly to the final destination URL to avoid redirect chains and PageRank dilution.',
      ));
    }
  }
  return issues;
}

/** 3. Missing meta descriptions */
function checkMetaDescriptions(rows) {
  const issues = [];
  for (const r of rows) {
    if (parseInt(r.statusCode, 10) !== 200) continue;
    const desc = (r.metaDescription || '').trim();
    if (!desc) {
      issues.push(issue(
        r.url,
        'Missing Meta Description',
        'No meta description found',
        SEV.high,
        'Add a unique, compelling meta description (120–160 chars) to improve click-through rates from SERPs.',
      ));
    } else if (desc.length < 70) {
      issues.push(issue(
        r.url,
        'Meta Description Too Short',
        `Length: ${desc.length} chars (min recommended: 70)`,
        SEV.medium,
        'Expand the meta description to 120–160 characters with relevant keywords and a clear call to action.',
      ));
    } else if (desc.length > 160) {
      issues.push(issue(
        r.url,
        'Meta Description Too Long',
        `Length: ${desc.length} chars (max recommended: 160)`,
        SEV.low,
        'Trim the meta description to under 160 characters to prevent truncation in search results.',
      ));
    }
  }
  return issues;
}

/** 4. Missing / duplicate H1s */
function checkH1s(rows) {
  const issues   = [];
  const h1Map    = new Map(); // h1 text → [urls]

  for (const r of rows) {
    if (parseInt(r.statusCode, 10) !== 200) continue;
    const h1 = (r.h1 || '').trim();

    if (!h1) {
      issues.push(issue(
        r.url,
        'Missing H1',
        'No H1 tag found on page',
        SEV.high,
        'Add a single, descriptive H1 that contains the primary keyword for the page.',
      ));
    } else {
      const key = h1.toLowerCase();
      if (!h1Map.has(key)) h1Map.set(key, []);
      h1Map.get(key).push(r.url);
    }
  }

  // Report duplicates
  for (const [h1Text, urls] of h1Map.entries()) {
    if (urls.length > 1) {
      for (const url of urls) {
        issues.push(issue(
          url,
          'Duplicate H1',
          `"${h1Text}" used on ${urls.length} pages`,
          SEV.medium,
          'Each page should have a unique H1 that accurately reflects its content and target keyword.',
        ));
      }
    }
  }

  return issues;
}

/** 5. Missing alt text on images */
function checkAltText(rows) {
  const issues = [];
  for (const r of rows) {
    if (parseInt(r.statusCode, 10) !== 200) continue;
    const missing = parseInt(r.imagesMissingAlt, 10) || 0;
    const total   = parseInt(r.imageCount, 10) || 0;
    if (missing > 0) {
      issues.push(issue(
        r.url,
        'Images Missing Alt Text',
        `${missing} of ${total} images lack alt attribute`,
        missing === total ? SEV.high : SEV.medium,
        'Add descriptive alt text to every image. Use keywords naturally; avoid stuffing. Leave alt="" for decorative images.',
      ));
    }
  }
  return issues;
}

/** 6. Pages with no internal links pointing out */
function checkNoInternalLinks(rows) {
  const issues = [];
  for (const r of rows) {
    if (parseInt(r.statusCode, 10) !== 200) continue;
    const internalCount = parseInt(r.internalLinks, 10);
    if (internalCount === 0) {
      issues.push(issue(
        r.url,
        'No Internal Links',
        'Page has 0 outgoing internal links',
        SEV.medium,
        'Add relevant internal links to help distribute PageRank and improve crawlability / user navigation.',
      ));
    }
  }
  return issues;
}

/** 7. Missing / duplicate titles */
function checkTitles(rows) {
  const issues   = [];
  const titleMap = new Map();

  for (const r of rows) {
    if (parseInt(r.statusCode, 10) !== 200) continue;
    const title = (r.title || '').trim();

    if (!title) {
      issues.push(issue(
        r.url,
        'Missing Title Tag',
        'No <title> tag found',
        SEV.critical,
        'Add a unique, keyword-rich title tag (50–60 chars) to every page.',
      ));
    } else {
      if (title.length < 30) {
        issues.push(issue(
          r.url,
          'Title Too Short',
          `Length: ${title.length} chars`,
          SEV.medium,
          'Expand the title to 50–60 characters including the primary keyword.',
        ));
      } else if (title.length > 60) {
        issues.push(issue(
          r.url,
          'Title Too Long',
          `Length: ${title.length} chars`,
          SEV.low,
          'Trim the title to under 60 characters to prevent truncation in SERPs.',
        ));
      }
      const key = title.toLowerCase();
      if (!titleMap.has(key)) titleMap.set(key, []);
      titleMap.get(key).push(r.url);
    }
  }

  // Duplicate titles
  for (const [titleText, urls] of titleMap.entries()) {
    if (urls.length > 1) {
      for (const url of urls) {
        issues.push(issue(
          url,
          'Duplicate Title Tag',
          `"${titleText}" used on ${urls.length} pages`,
          SEV.high,
          'Give each page a unique title tag that reflects its specific content and target keyword.',
        ));
      }
    }
  }

  return issues;
}

/** 8. Low word count (thin content) */
function checkWordCount(rows) {
  const issues = [];
  for (const r of rows) {
    if (parseInt(r.statusCode, 10) !== 200) continue;
    const words = parseInt(r.wordCount, 10) || 0;
    if (words < 100 && words > 0) {
      issues.push(issue(
        r.url,
        'Thin Content',
        `Only ${words} words on page`,
        SEV.medium,
        'Expand the page content to at least 300 words. Thin content pages may be devalued by search engines.',
      ));
    }
  }
  return issues;
}

/** 9. Missing canonical tag */
function checkCanonical(rows) {
  const issues = [];
  for (const r of rows) {
    if (parseInt(r.statusCode, 10) !== 200) continue;
    const canonical = (r.canonical || '').trim();
    if (!canonical) {
      issues.push(issue(
        r.url,
        'Missing Canonical Tag',
        'No <link rel="canonical"> found',
        SEV.medium,
        'Add a self-referencing canonical tag to every page to prevent duplicate content issues.',
      ));
    }
  }
  return issues;
}

// ─── Severity sort order ──────────────────────────────────────────────────────
const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const rows = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

  console.log(`\n🔍  SEO Issue Analyzer`);
  console.log(`   Input : ${INPUT_FILE} (${rows.length} URLs)`);

  const all = [
    ...checkBrokenLinks(rows),
    ...checkRedirects(rows),
    ...checkTitles(rows),
    ...checkMetaDescriptions(rows),
    ...checkH1s(rows),
    ...checkAltText(rows),
    ...checkNoInternalLinks(rows),
    ...checkWordCount(rows),
    ...checkCanonical(rows),
  ];

  // Sort: Critical first, then by URL
  all.sort((a, b) => {
    const sd = (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9);
    if (sd !== 0) return sd;
    return a.url.localeCompare(b.url);
  });

  // Write JSON
  fs.writeFileSync(JSON_OUTPUT_FILE, JSON.stringify(all, null, 2), 'utf8');

  // ─── Console summary ───────────────────────────────────────────────────────
  const counts = {};
  for (const i of all) counts[i.severity] = (counts[i.severity] || 0) + 1;

  const byType = {};
  for (const i of all) byType[i.issue] = (byType[i.issue] || 0) + 1;

  console.log('─────────────────────────────────────────');
  console.log('📊  Issue Summary by Severity');
  for (const sev of ['Critical', 'High', 'Medium', 'Low']) {
    if (counts[sev]) console.log(`   ${sev.padEnd(10)}: ${counts[sev]}`);
  }
  console.log('\n📋  Issue Breakdown by Type');
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(count).padStart(4)}x  ${type}`);
  }
  console.log(`\n   Total issues : ${all.length}`);
  console.log(`   JSON output  : ${JSON_OUTPUT_FILE}`);
  console.log('─────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

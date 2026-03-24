'use strict';

/**
 * Excel SEO Report Generator
 * Combines issues.csv + cwv-report.csv into a styled Excel workbook.
 *
 * Usage: node excel-report.js
 * Output: seo-report.xlsx
 */

const fs       = require('fs');
const ExcelJS  = require('exceljs');
const { parse } = require('csv-parse/sync');

// ─── Config ───────────────────────────────────────────────────────────────────
const ISSUES_FILE  = 'issues.csv';
const CWV_FILE     = 'cwv-report.csv';
const OUTPUT_FILE  = 'seo-report.xlsx';

// ─── Colour palette ───────────────────────────────────────────────────────────
const COLORS = {
  critical : { bg: 'FFFF0000', font: 'FFFFFFFF' },  // Red
  high     : { bg: 'FFFF6600', font: 'FFFFFFFF' },  // Orange
  medium   : { bg: 'FFFFC000', font: 'FF000000' },  // Yellow/Amber
  low      : { bg: 'FF92D050', font: 'FF000000' },  // Green
  good     : { bg: 'FF92D050', font: 'FF000000' },  // Green
  na       : { bg: 'FFD9D9D9', font: 'FF595959' },  // Grey
  header   : { bg: 'FF1F3864', font: 'FFFFFFFF' },  // Dark navy
  subhdr   : { bg: 'FF2E75B6', font: 'FFFFFFFF' },  // Mid blue
  accent   : { bg: 'FFDAE3F3', font: 'FF1F3864' },  // Light blue
  white    : { bg: 'FFFFFFFF', font: 'FF000000' },
  altrow   : { bg: 'FFF2F2F2', font: 'FF000000' },
};

function fill(hex)   { return { type: 'pattern', pattern: 'solid', fgColor: { argb: hex } }; }
function font(hex, bold = false, size = 11) {
  return { color: { argb: hex }, bold, size, name: 'Calibri' };
}

function severityColor(sev) {
  switch ((sev || '').toLowerCase()) {
    case 'critical': return COLORS.critical;
    case 'high':     return COLORS.high;
    case 'medium':   return COLORS.medium;
    case 'low':      return COLORS.low;
    default:         return COLORS.na;
  }
}

function cwvTagColor(tag) {
  switch ((tag || '').toLowerCase()) {
    case 'critical': return COLORS.critical;
    case 'high':     return COLORS.high;
    case 'good':     return COLORS.good;
    default:         return COLORS.na;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function styleHeaderRow(row, bgHex, fontHex) {
  row.eachCell(cell => {
    cell.fill = fill(bgHex);
    cell.font = font(fontHex, true, 11);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF999999' } },
    };
  });
  row.height = 30;
}

function styleDataCell(cell, rowIdx, coloring) {
  const base = rowIdx % 2 === 0 ? COLORS.altrow : COLORS.white;
  cell.fill = fill(coloring ? coloring.bg : base.bg);
  cell.font = font(coloring ? coloring.font : base.font, false, 10);
  cell.alignment = { vertical: 'middle', wrapText: true };
  cell.border = {
    bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
  };
}

function addTitle(sheet, text, subtitle) {
  const t = sheet.addRow([text]);
  t.getCell(1).font = font(COLORS.header.font, true, 16);
  t.getCell(1).fill = fill(COLORS.header.bg);
  t.height = 36;
  sheet.mergeCells(`A${t.number}:H${t.number}`);

  if (subtitle) {
    const s = sheet.addRow([subtitle]);
    s.getCell(1).font = font('FF444444', false, 10);
    s.getCell(1).fill = fill(COLORS.accent.bg);
    s.height = 20;
    sheet.mergeCells(`A${s.number}:H${s.number}`);
  }
  sheet.addRow([]);  // spacer
}

function autoWidth(sheet, minWidth = 14, maxWidth = 60) {
  sheet.columns.forEach(col => {
    let max = minWidth;
    col.eachCell({ includeEmpty: false }, cell => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, maxWidth);
  });
}

// ─── Load CSVs ────────────────────────────────────────────────────────────────
function loadCsv(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8');
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
}

// ─── Sheet 1: Executive Summary ──────────────────────────────────────────────
function buildSummarySheet(wb, issues, cwv) {
  const sheet = wb.addWorksheet('Executive Summary', {
    views: [{ showGridLines: false }],
    pageSetup: { fitToPage: true, fitToWidth: 1 },
  });
  sheet.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

  addTitle(sheet, '🔍 SEO Audit — Executive Summary',
    `Generated: ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}`);

  // ── Issue counts by severity ───────────────────────────────────────────────
  const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const i of issues) sevCounts[i['Severity']] = (sevCounts[i['Severity']] || 0) + 1;

  const hdr = sheet.addRow(['Issue Severity Breakdown', 'Count', '', '', '']);
  styleHeaderRow(hdr, COLORS.subhdr.bg, COLORS.subhdr.font);
  sheet.mergeCells(`A${hdr.number}:E${hdr.number}`);

  let ri = 0;
  for (const [sev, count] of Object.entries(sevCounts)) {
    const c  = severityColor(sev);
    const r  = sheet.addRow([sev, count]);
    r.getCell(1).fill = fill(c.bg);
    r.getCell(1).font = font(c.font, true, 11);
    r.getCell(2).fill = fill(c.bg);
    r.getCell(2).font = font(c.font, true, 14);
    r.getCell(2).alignment = { horizontal: 'center' };
    r.height = 24;
    ri++;
  }

  const totalRow = sheet.addRow(['Total Issues Found', issues.length]);
  totalRow.getCell(1).font = font(COLORS.header.bg, true, 11);
  totalRow.getCell(2).font = font(COLORS.header.bg, true, 14);
  totalRow.getCell(2).alignment = { horizontal: 'center' };
  totalRow.height = 24;

  sheet.addRow([]);

  // ── CWV Summary ────────────────────────────────────────────────────────────
  if (cwv.length > 0) {
    const cvHdr = sheet.addRow(['Core Web Vitals Highlights', 'Value', '', '', '']);
    styleHeaderRow(cvHdr, COLORS.subhdr.bg, COLORS.subhdr.font);
    sheet.mergeCells(`A${cvHdr.number}:E${cvHdr.number}`);

    const scored   = cwv.filter(r => !isNaN(parseFloat(r['Performance Score (0–100)'])));
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, r) => s + parseFloat(r['Performance Score (0–100)']), 0) / scored.length)
      : 'N/A';

    const lcpCritical = cwv.filter(r => r['LCP Tag'] === 'Critical').length;
    const lcpHigh     = cwv.filter(r => r['LCP Tag'] === 'High').length;
    const clsCritical = cwv.filter(r => r['CLS Tag'] === 'Critical').length;
    const ttfbHigh    = cwv.filter(r => r['TTFB Tag'] === 'Critical' || r['TTFB Tag'] === 'High').length;

    const metrics = [
      ['URLs Audited', cwv.length],
      ['Avg Performance Score', avgScore],
      ['LCP Critical (> 4s)', lcpCritical],
      ['LCP High (2.5–4s)',    lcpHigh],
      ['CLS Critical (> 0.25)',clsCritical],
      ['TTFB Issues',          ttfbHigh],
    ];

    let rIdx = 0;
    for (const [label, val] of metrics) {
      const r = sheet.addRow([label, val]);
      const base = rIdx % 2 === 0 ? COLORS.white : COLORS.altrow;
      r.getCell(1).fill = fill(base.bg);
      r.getCell(1).font = font(base.font, false, 10);
      r.getCell(2).fill = fill(base.bg);
      r.getCell(2).font = font(base.font, true, 11);
      r.getCell(2).alignment = { horizontal: 'center' };
      r.height = 22;
      rIdx++;
    }
  }

  sheet.addRow([]);

  // ── Scoring legend ─────────────────────────────────────────────────────────
  const legHdr = sheet.addRow(['Severity Legend', 'Threshold / Meaning']);
  styleHeaderRow(legHdr, COLORS.subhdr.bg, COLORS.subhdr.font);

  const legend = [
    ['🔴 Critical', 'Broken pages, missing titles, 5xx — fix immediately'],
    ['🟠 High',     'Missing meta desc, duplicate titles, missing H1, broken imgs'],
    ['🟡 Medium',   'Thin content, missing canonical, redirects, no internal links'],
    ['🟢 Low',      'Minor SEO hygiene — title/desc length tweaks'],
  ];
  let li = 0;
  for (const [sev, desc] of legend) {
    const r = sheet.addRow([sev, desc]);
    r.getCell(1).font = font('FF000000', true, 10);
    r.getCell(2).font = font('FF000000', false, 10);
    const base = li % 2 === 0 ? COLORS.white : COLORS.altrow;
    r.getCell(1).fill = r.getCell(2).fill = fill(base.bg);
    r.height = 20;
    li++;
  }
}

// ─── Sheet 2: Issues by Type ──────────────────────────────────────────────────
function buildIssuesSheet(wb, issues) {
  const sheet = wb.addWorksheet('Issues by Type', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 4 }],
  });

  sheet.columns = [
    { key: 'url',      width: 46 },
    { key: 'issue',    width: 28 },
    { key: 'detail',   width: 36 },
    { key: 'severity', width: 12 },
    { key: 'rec',      width: 54 },
  ];

  addTitle(sheet, '📋 SEO Issues by Type', `${issues.length} issues found across all pages`);

  const hdr = sheet.addRow(['URL', 'Issue', 'Detail', 'Severity', 'Fix Recommendation']);
  styleHeaderRow(hdr, COLORS.header.bg, COLORS.header.font);

  issues.forEach((row, i) => {
    const sev = row['Severity'];
    const c   = severityColor(sev);
    const r   = sheet.addRow([
      row['URL'],
      row['Issue'],
      row['Detail'],
      sev,
      row['Fix Recommendation'],
    ]);
    r.height = 18;

    // Colour only the Severity cell; zebra-stripe the rest
    r.eachCell((cell, colNum) => {
      if (colNum === 4) {
        cell.fill = fill(c.bg);
        cell.font = font(c.font, true, 10);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        styleDataCell(cell, i, null);
        cell.font = font(i % 2 === 0 ? COLORS.white.font : COLORS.altrow.font, false, 10);
      }
    });
  });

  // Auto-filter on header row
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 5 } };
}

// ─── Sheet 3: Core Web Vitals ─────────────────────────────────────────────────
function buildCWVSheet(wb, cwv) {
  const sheet = wb.addWorksheet('Core Web Vitals', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 4 }],
  });

  sheet.columns = [
    { width: 44 }, // URL
    { width: 12 }, // Strategy
    { width: 14 }, // Score
    { width: 10 }, // LCP
    { width: 12 }, // LCP Tag
    { width: 10 }, // CLS
    { width: 12 }, // CLS Tag
    { width: 12 }, // FID
    { width: 12 }, // FID Tag
    { width: 12 }, // TTFB
    { width: 12 }, // TTFB Tag
    { width: 10 }, // FCP
    { width: 10 }, // TBT
    { width: 14 }, // Speed Index
  ];

  addTitle(sheet, '⚡ Core Web Vitals Report', `${cwv.length} pages audited via PageSpeed Insights`);

  const headers = ['URL','Strategy','Score','LCP (s)','LCP Tag','CLS','CLS Tag',
                   'FID/INP (ms)','FID Tag','TTFB (ms)','TTFB Tag','FCP (s)','TBT (ms)','Speed Index'];
  const hdr = sheet.addRow(headers);
  styleHeaderRow(hdr, COLORS.header.bg, COLORS.header.font);

  const tagCols = { 5: 'lcp', 7: 'cls', 9: 'fid', 11: 'ttfb' }; // colNum → tag field index offset

  cwv.forEach((row, i) => {
    const r = sheet.addRow([
      row['URL'],
      row['Strategy'],
      row['Performance Score (0–100)'],
      row['LCP (s)'],
      row['LCP Tag'],
      row['CLS'],
      row['CLS Tag'],
      row['FID / INP (ms)'],
      row['FID / INP Tag'],
      row['TTFB (ms)'],
      row['TTFB Tag'],
      row['FCP (s)'],
      row['TBT (ms)'],
      row['Speed Index (s)'],
    ]);
    r.height = 18;

    r.eachCell((cell, colNum) => {
      const tagKeys = { 5: row['LCP Tag'], 7: row['CLS Tag'], 9: row['FID / INP Tag'], 11: row['TTFB Tag'] };
      if (tagKeys[colNum] !== undefined) {
        const c = cwvTagColor(tagKeys[colNum]);
        cell.fill = fill(c.bg);
        cell.font = font(c.font, true, 10);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colNum === 3) {
        // Score — colour by value
        const score = parseFloat(cell.value);
        const sc = isNaN(score) ? COLORS.na :
                   score >= 90  ? COLORS.good :
                   score >= 50  ? COLORS.medium : COLORS.critical;
        cell.fill = fill(sc.bg);
        cell.font = font(sc.font, true, 11);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        styleDataCell(cell, i, null);
      }
    });
  });

  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: headers.length } };
}

// ─── Sheet 4: Top 10 Fixes ────────────────────────────────────────────────────
function buildTop10Sheet(wb, issues) {
  const sheet = wb.addWorksheet('Top 10 Fixes', {
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { width: 6  },
    { width: 28 },
    { width: 12 },
    { width: 14 },
    { width: 54 },
  ];

  addTitle(sheet, '🏆 Top 10 Actionable SEO Fixes',
    'Sorted by severity · Address Critical items first for maximum impact');

  const hdr = sheet.addRow(['#', 'Issue Type', 'Count', 'Severity', 'Fix Recommendation']);
  styleHeaderRow(hdr, COLORS.header.bg, COLORS.header.font);

  // Group by issue type, pick highest severity, count occurrences
  const grouped = {};
  const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

  for (const row of issues) {
    const key = row['Issue'];
    if (!grouped[key]) {
      grouped[key] = { issue: key, severity: row['Severity'], count: 0, rec: row['Fix Recommendation'] };
    }
    grouped[key].count++;
    // Escalate to worst severity seen
    if (SEV_ORDER[row['Severity']] < SEV_ORDER[grouped[key].severity]) {
      grouped[key].severity = row['Severity'];
    }
  }

  const sorted = Object.values(grouped)
    .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) || b.count - a.count)
    .slice(0, 10);

  sorted.forEach((item, i) => {
    const c = severityColor(item.severity);
    const r = sheet.addRow([i + 1, item.issue, item.count, item.severity, item.rec]);
    r.height = 22;

    r.eachCell((cell, colNum) => {
      if (colNum === 4) {
        cell.fill = fill(c.bg);
        cell.font = font(c.font, true, 11);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colNum === 1) {
        cell.fill = fill(COLORS.subhdr.bg);
        cell.font = font(COLORS.subhdr.font, true, 12);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        const base = i % 2 === 0 ? COLORS.white : COLORS.altrow;
        cell.fill = fill(base.bg);
        cell.font = font(base.font, colNum === 3, 10);
        cell.alignment = { vertical: 'middle', wrapText: true };
      }
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const issues = loadCsv(ISSUES_FILE);
  const cwv    = loadCsv(CWV_FILE);

  if (issues.length === 0 && cwv.length === 0) {
    console.error('\n❌  Both issues.csv and cwv-report.csv are empty or missing.\n');
    process.exit(1);
  }

  console.log(`\n📊  Building Excel SEO Report`);
  console.log(`   Issues  : ${issues.length} rows from ${ISSUES_FILE}`);
  console.log(`   CWV     : ${cwv.length} rows from ${CWV_FILE}`);
  console.log(`   Output  : ${OUTPUT_FILE}\n`);

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'SEO Engine';
  wb.created  = new Date();
  wb.modified = new Date();

  buildSummarySheet(wb, issues, cwv);
  buildIssuesSheet(wb, issues);
  if (cwv.length > 0) buildCWVSheet(wb, cwv);
  buildTop10Sheet(wb, issues);

  await wb.xlsx.writeFile(OUTPUT_FILE);
  console.log(`✅  Report saved: ${OUTPUT_FILE}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

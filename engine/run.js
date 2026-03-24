'use strict';

/**
 * SEO Pipeline Runner
 * Runs all tools sequentially: crawler → CWV → issues → Excel report
 *
 * Usage:
 *   node run.js <start-url> <api-key> [max-pages] [strategy]
 *
 * Example:
 *   node run.js https://vadify.in/ AIzaSy... 200 mobile
 */

const { spawn } = require('child_process');
const path      = require('path');
const fs        = require('fs');

const STATUS_FILE = path.resolve(__dirname, '../data/status.json');
function updateStatus(state, step, progress, error = null) {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({ state, step, progress, error }));
  } catch (e) {}
}

// ─── CLI Args ─────────────────────────────────────────────────────────────────
const START_URL  = process.argv[2];
const API_KEY    = process.argv[3] || 'AIzaSyAq1TXph15YXDNEJhj-7Sht5o09LkOpRAw';
const MAX_PAGES  = process.argv[4] || '200';
const STRATEGY   = process.argv[5] || 'mobile';

if (!START_URL || !API_KEY) {
  console.error(`
Usage: node run.js <start-url> <api-key> [max-pages] [strategy]

  start-url   Website to crawl (e.g. https://example.com)
  api-key     Google PageSpeed Insights API key
  max-pages   Max pages to crawl (default: 200)
  strategy    mobile | desktop (default: mobile)

Example:
  node run.js https://vadify.in/ AIzaSy... 200 mobile
`);
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const GREEN  = '\x1b[32m';
const CYAN   = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const DIM    = '\x1b[2m';

function log(msg) { console.log(msg); }
function hr()     { log(`${DIM}${'─'.repeat(60)}${RESET}`); }

function banner(step, total, label) {
  hr();
  log(`${BOLD}${CYAN}  Step ${step}/${total} — ${label}${RESET}`);
  hr();
}

function timestamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

/**
 * Run a Node.js script as a child process, pipe its output, and resolve
 * with the exit code when it finishes.
 */
function runScript(scriptFile, args = []) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child = spawn(
      process.execPath,                       // same node binary
      [path.resolve(__dirname, scriptFile), ...args],
      { 
        stdio: ['ignore', 'inherit', 'inherit'],
        windowsHide: true
      },
    );

    child.on('error', err => reject(new Error(`Failed to start ${scriptFile}: ${err.message}`)));

    child.on('close', code => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      if (code === 0) {
        log(`${GREEN}✅  ${scriptFile} finished in ${elapsed}s${RESET}`);
        resolve(code);
      } else {
        // Non-zero exit — treat CWV step as non-fatal (API key may be absent)
        resolve(code);
      }
    });
  });
}

// ─── Pipeline steps ───────────────────────────────────────────────────────────
const STEPS = [
  {
    label  : 'SEO Audit Engine  →  crawl.json',
    script : 'audit.js',
    args   : () => [START_URL, MAX_PAGES],
    fatal  : true,   // pipeline stops here if this fails
  },
  {
    label  : 'CWV Report  →  cwv.json',
    script : 'cwv.js',
    args   : () => [API_KEY, STRATEGY],
    fatal  : false,  // missing API key / rate limits should not stop the pipeline
  }
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  updateStatus('running', 'Initializing...', 5);
  const pipelineStart = Date.now();

  log('');
  log(`${BOLD}${CYAN}╔══════════════════════════════════════════════════╗${RESET}`);
  log(`${BOLD}${CYAN}║          SEO Engine — Full Pipeline Run          ║${RESET}`);
  log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════╝${RESET}`);
  log('');
  log(`  ${BOLD}Target   :${RESET} ${START_URL}`);
  log(`  ${BOLD}Max pages:${RESET} ${MAX_PAGES}`);
  log(`  ${BOLD}Strategy :${RESET} ${STRATEGY}`);
  log(`  ${BOLD}Started  :${RESET} ${timestamp()}`);
  log('');

  try {
    for (let i = 0; i < STEPS.length; i++) {
      const { label, script, args, fatal } = STEPS[i];
      banner(i + 1, STEPS.length, label);

      let stepName = 'Running...';
      let prog = 10;
      if (script === 'audit.js') { stepName = 'Crawling and Analyzing pages...'; prog = 10; }
      else if (script === 'cwv.js') { stepName = 'Analyzing performance...'; prog = 85; }
      
      // We don't overwrite audit.js progress inside the loop because audit.js manages its own detailed progress in the status file!
      if (script !== 'audit.js') {
        updateStatus('running', stepName, prog);
      }

      let code;
      try {
        code = await runScript(script, args());
      } catch (err) {
        log(`${RED}❌  Error running ${script}: ${err.message}${RESET}`);
        if (fatal) {
          throw new Error(`Pipeline aborted at ${script}: ${err.message}`);
        }
        log(`${YELLOW}⚠️  Non-fatal step failed — continuing pipeline…${RESET}`);
        continue;
      }

      if (code !== 0) {
        if (fatal) {
          throw new Error(`${script} exited with code ${code}. Pipeline aborted.`);
        }
        log(`${YELLOW}⚠️  ${script} exited with code ${code} (non-fatal) — continuing…${RESET}`);
      }
    }

    const totalSec = ((Date.now() - pipelineStart) / 1000).toFixed(1);

    log('');
    hr();
    log(`${BOLD}${GREEN}  🎉  Pipeline complete in ${totalSec}s${RESET}`);
    log('');
    log(`  ${BOLD}Outputs (JSON only):${RESET}`);
    log(`    📄  crawl.json         — Raw crawl data & Issues`);
    log(`    ⚡  cwv.json           — Core Web Vitals`);
    log('');
    hr();

  } catch (err) {
    console.error(`\n${RED}Fatal pipeline error: ${err.message}${RESET}`);
    updateStatus('error', 'Failed', 0, err.message);
    process.exit(1);
  } finally {
    // Read current state to avoid overwriting a fresh 'running' status if another audit was just queued
    try {
      const cur = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
      if (cur.state === 'running' || cur.state === 'idle') {
        // If it didn't error out, mark complete
        updateStatus('completed', 'Done', 100);
      }
    } catch(e) {
      updateStatus('completed', 'Done', 100);
    }
  }
}

main();

# Fix 404 favicon.ico and 500 /api/run-audit

## Status: ✅ Favicon fixed. Puppeteer/cheerio installed at root (confirmed `node_modules/puppeteer` exists).

## Remaining Steps:
- [ ] **Step 2: Engine deps** (manual): 
  ```
  cd /d d:\programs\SEO\engine
  npm init -y
  npm i puppeteer cheerio
  ```
- [x] **Step 3: Added detailed logging** to `dashboard/app/api/run-audit/route.ts`
- [ ] **Step 4: Test** (run server, POST to /api/run-audit)
  - `cd dashboard && npm run dev`
  - Test: `curl -X POST http://localhost:3000/api/run-audit -H "Content-Type: application/json" -d "{\"url\":\"https://example.com\"}"`
  - Check console/terminal logs for spawn details or errors.
- [ ] **Step 5: Add .env.local** if needed: `PAGESPEED_API_KEY=yourkey`

**Next: Run deps in engine/, start dev server, test API. Report any new logs/errors after test.**

To demo: `cd dashboard && npm run dev` (open http://localhost:3000)

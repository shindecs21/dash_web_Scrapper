# dash_web_Scrapper

Scheduled web scrapers + static dashboard on **GitHub Actions** and **GitHub Pages**.

**Phase 1:** [Zingoy](https://www.zingoy.com/gift-cards) gift cards — 48 stores (4 listing pages), top 6 vouchers each, cashback sorted.

## Live site (after setup)

1. Push this repo to GitHub
2. **Settings → Pages → Build and deployment → Source:** `GitHub Actions`
3. Run the workflow once: **Actions → Scrape Zingoy gift cards → Run workflow**
4. Open: `https://shindecs21.github.io/dash_web_Scrapper/`

## Local development

```powershell
npm install
npx playwright install chromium
npm run scrape          # full: 48 stores, ~30s with parallel workers
npm run scrape:quick    # 3 stores smoke test
```

Serve dashboard:

```powershell
cd public
npx serve -l 3456
# http://localhost:3456
```

## GitHub Actions flow

```
Cron (daily 1:30 UTC)  or  Run workflow (manual)
        ↓
Playwright scrape (Node 20, Ubuntu)
        ↓
Commit data/zingoy.json + public/data/zingoy.json
        ↓
Deploy public/ → GitHub Pages
```

**Manual run:** Actions tab → **Scrape Zingoy gift cards** → **Run workflow**.

Optional inputs: `limit_stores`, `limit_vouchers`, `listing_pages`, `concurrency`.

## Project structure

| Path | Purpose |
|------|---------|
| `scrapers/zingoy.mjs` | Main scraper |
| `scrapers/lib/` | HTML parsers |
| `public/index.html` | Expandable deals table |
| `data/zingoy.json` | Latest scrape output |
| `docs/PLAN.md` | Future phases roadmap |

## Roadmap

See [docs/PLAN.md](docs/PLAN.md) for Phases 2–6 (Fetch latest button, multi-site, alerts, etc.).

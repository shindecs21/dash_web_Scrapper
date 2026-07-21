# Dashboard Web Scraper — Roadmap

Personal dashboard that scrapes deal sites on a schedule, stores JSON in GitHub, and serves a static UI on GitHub Pages.

## Phase 1 — Zingoy (current)

**Goal:** Cashback-sorted gift card deals in one expandable table.

| Item | Status |
|------|--------|
| Scrape 4 listing pages (48 stores, cashback sorted) | Done |
| Per store: top 6 vouchers (`sort_by=discount`, ₹100–₹5000) | Done |
| Empty stores: fallback “Earn upto X% Cashback” from product page | Done |
| Parallel scrape (~6 workers, ~31s total) | Done |
| Static dashboard (`public/index.html`) | Done |
| GitHub Actions: cron + manual run + Pages deploy | Done |

**Live flow**

1. Cron or “Run workflow” triggers Actions
2. `npm run scrape` → `data/zingoy.json` + `public/data/zingoy.json`
3. Bot commits JSON (if changed)
4. GitHub Pages serves `public/`

---

## Phase 2 — GitHub polish

| Item | Notes |
|------|--------|
| Enable GitHub Pages (Source: GitHub Actions) | One-time repo setting |
| Verify first workflow run on `main` | Actions tab → Run workflow |
| README badges (workflow status, Pages URL) | Optional |
| Split workflow: scrape job + deploy job | If commit/push needs separate permissions |
| Workflow status in dashboard header | “Last updated …” from JSON `scrapedAt` |

---

## Phase 3 — “Fetch latest” button

Static Pages cannot call GitHub API with a secret safely.

| Item | Notes |
|------|--------|
| Cloudflare Worker (or Vercel serverless) | Holds fine-grained PAT |
| `repository_dispatch` event in workflow | `event_type: fetch-latest` |
| Dashboard button → Worker → GitHub API | Optional shared secret header |
| UI: loading state + auto-refresh after ~1 min | Poll `zingoy.json` timestamp |

---

## Phase 4 — Multi-source dashboard

| Source | Scraper | Output |
|--------|---------|--------|
| Zingoy gift cards | `scrapers/zingoy.mjs` | `data/zingoy.json` |
| Lakmé salon (Balewadi) | API scraper (existing) | `data/lakme.json` |
| Site 3–5 | TBD | `data/siteN.json` |

| Item | Notes |
|------|--------|
| `scripts/merge.mjs` → `data/latest.json` | Single file for UI |
| Tabs or filters per source | Same table pattern |
| Matrix jobs in Actions | Scrape sources in parallel |

---

## Phase 5 — Alerts & history

| Item | Notes |
|------|--------|
| Telegram / email when cashback &gt; threshold | e.g. Dominos ≥ 45% |
| Daily JSON commits as history | Chart trends over time |
| Compare vs yesterday | Highlight new top deals |

---

## Phase 6 — Other data (careful)

| Use case | Approach |
|----------|----------|
| Stock / portfolio | Public or broker API + Secrets |
| Bill due reminders | Prefer email parsing or manual entry, not bank login scrape |
| Login-protected portals | Official API only; avoid storing bank passwords in Actions |

---

## Technical defaults (Zingoy)

| Setting | Value |
|---------|--------|
| Listing URL | `sort_by=cashback`, pages 1–4 |
| Store filter | `price_min=100&price_max=5000&sort_by=discount` |
| Vouchers per store | 6 |
| Empty page wait | 4s max |
| Concurrency | 6 |

---

## Repo layout

```
.github/workflows/scrape.yml   # cron + workflow_dispatch + Pages
scrapers/zingoy.mjs            # main entry
scrapers/lib/                  # parsers
public/index.html              # dashboard
public/data/zingoy.json        # copy for Pages
data/zingoy.json               # repo copy
docs/PLAN.md                   # this file
```

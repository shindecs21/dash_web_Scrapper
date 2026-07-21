import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parseStoresFromListing } from './lib/parse-stores.mjs';
import { parseVouchersFromPage } from './lib/parse-vouchers.mjs';
import { parseStorePageCashback } from './lib/parse-page-cashback.mjs';
import { mapPool } from './lib/map-pool.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'data', 'zingoy.json');
const PUBLIC_OUT_FILE = path.join(ROOT, 'public', 'data', 'zingoy.json');

function listingPageUrl(pageNum) {
  if (pageNum === 1) {
    return 'https://www.zingoy.com/gift-cards?search_store=&search_category=&sort_by=cashback';
  }
  return `https://www.zingoy.com/gift-cards?page=${pageNum}&search_category=&search_store=&sort_by=cashback`;
}

const MAX_LISTING_PAGES = 4;
const LISTING_PAGES = Array.from({ length: MAX_LISTING_PAGES }, (_, i) => listingPageUrl(i + 1));
const STORE_QUERY = 'price_min=100&price_max=5000&sort_by=discount';

function parseArgs(argv) {
  const args = {
    limitStores: 48,
    limitVouchers: 6,
    listingPages: MAX_LISTING_PAGES,
    concurrency: 6,
    headless: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit-stores') args.limitStores = Number(argv[++i]);
    else if (arg === '--limit-vouchers') args.limitVouchers = Number(argv[++i]);
    else if (arg === '--listing-pages') args.listingPages = Number(argv[++i]);
    else if (arg === '--concurrency') args.concurrency = Number(argv[++i]);
    else if (arg === '--headed') args.headless = false;
  }

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchBrowser(headless) {
  const launchOptions = { headless };

  try {
    return await chromium.launch({ ...launchOptions, channel: 'msedge' });
  } catch {
    return chromium.launch(launchOptions);
  }
}

async function scrapeStore(page, store, limitVouchers) {
  const url = `${store.url}?${STORE_QUERY}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const hasVouchers = await page
    .waitForSelector('.gift-card-list-item', { timeout: 4000 })
    .catch(() => null);
  if (hasVouchers) await sleep(1000);

  const vouchers = await parseVouchersFromPage(page, limitVouchers);
  const pageCashback = await parseStorePageCashback(page);

  return {
    ...store,
    productUrl: url,
    voucherCount: vouchers.length,
    vouchers,
    pageTitle: pageCashback.pageTitle,
    earnUptoCashback: pageCashback.earnUptoCashback,
    earnUptoText: pageCashback.earnUptoText,
  };
}

async function loadAllStores(browser, listingPages) {
  const headers = { 'Accept-Language': 'en-IN,en;q=0.9' };

  const pageResults = await mapPool(listingPages, listingPages.length, async (listingUrl, index) => {
    const pageNum = index + 1;
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders(headers);

    console.log(`Loading listing page ${pageNum}:`, listingUrl);
    await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sleep(3000);

    const stores = await parseStoresFromListing(page, pageNum);
    console.log(`  found ${stores.length} stores on page ${pageNum}`);
    await page.close();
    return stores;
  });

  /** @type {Array<{ slug: string, name: string, url: string, listingPage: number, listingRank: number, listingCashback: string | null }>} */
  const allStores = [];
  const seen = new Set();

  for (const pageStores of pageResults) {
    for (const store of pageStores) {
      if (seen.has(store.slug)) continue;
      seen.add(store.slug);
      allStores.push({
        ...store,
        listingRank: allStores.length + 1,
      });
    }
  }

  return allStores;
}

async function scrapeStoresParallel(browser, stores, limitVouchers, concurrency) {
  const headers = { 'Accept-Language': 'en-IN,en;q=0.9' };
  const pages = await Promise.all(
    Array.from({ length: concurrency }, async () => {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders(headers);
      return page;
    }),
  );

  const results = new Array(stores.length);
  let nextIndex = 0;
  let done = 0;

  async function worker(page) {
    while (nextIndex < stores.length) {
      const index = nextIndex;
      nextIndex += 1;
      const store = stores[index];
      const storeStarted = Date.now();
      console.log(`[${index + 1}/${stores.length}] ${store.name} (${store.slug})`);

      try {
        results[index] = await scrapeStore(page, store, limitVouchers);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  failed: ${message}`);
        results[index] = {
          ...store,
          productUrl: `${store.url}?${STORE_QUERY}`,
          voucherCount: 0,
          vouchers: [],
          error: message,
        };
      }

      done += 1;
      console.log(`  done in ${((Date.now() - storeStarted) / 1000).toFixed(1)}s (${done}/${stores.length})`);
    }
  }

  try {
    await Promise.all(pages.map((page) => worker(page)));
    return results;
  } finally {
    await Promise.all(pages.map((page) => page.close()));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const browser = await launchBrowser(args.headless);

  const listingPages = LISTING_PAGES.slice(0, args.listingPages);
  const listingStarted = Date.now();
  const allStores = await loadAllStores(browser, listingPages);
  const listingMs = Date.now() - listingStarted;
  const stores = allStores.slice(0, args.limitStores);

  console.log(`Found ${allStores.length} stores across ${listingPages.length} page(s); scraping ${stores.length}`);
  console.log(`Listing phase: ${(listingMs / 1000).toFixed(1)}s`);
  console.log(`Concurrency: ${args.concurrency}`);

  const scrapeStarted = Date.now();
  const results = await scrapeStoresParallel(browser, stores, args.limitVouchers, args.concurrency);
  const scrapeMs = Date.now() - scrapeStarted;
  const totalMs = Date.now() - t0;

  await browser.close();

  const payload = {
    source: 'zingoy.com',
    listingUrls: listingPages,
    listingSort: 'cashback',
    listingPageCount: listingPages.length,
    voucherSort: 'discount',
    storeQuery: STORE_QUERY,
    concurrency: args.concurrency,
    scrapedAt: startedAt,
    finishedAt: new Date().toISOString(),
    timing: {
      listingMs,
      scrapeMs,
      totalMs,
      listingSec: Math.round(listingMs / 1000),
      scrapeSec: Math.round(scrapeMs / 1000),
      totalSec: Math.round(totalMs / 1000),
      avgSecPerStore: stores.length ? Math.round(scrapeMs / stores.length / 1000) : 0,
    },
    storeCount: results.length,
    stores: results,
  };

  const json = `${JSON.stringify(payload, null, 2)}\n`;

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await mkdir(path.dirname(PUBLIC_OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, json, 'utf8');
  await writeFile(PUBLIC_OUT_FILE, json, 'utf8');

  console.log(`Wrote ${OUT_FILE}`);
  console.log(`Wrote ${PUBLIC_OUT_FILE}`);
  console.log(
    `Timing: listing ${payload.timing.listingSec}s · scrape ${payload.timing.scrapeSec}s · total ${payload.timing.totalSec}s · ~${payload.timing.avgSecPerStore}s/store (wall)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

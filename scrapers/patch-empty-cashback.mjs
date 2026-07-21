import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parseStorePageCashback } from './lib/parse-page-cashback.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const files = [
  path.join(ROOT, 'data', 'zingoy.json'),
  path.join(ROOT, 'public', 'data', 'zingoy.json'),
];

const json = JSON.parse(await readFile(files[0], 'utf8'));
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage();

let updated = 0;

for (const store of json.stores) {
  if (store.vouchers?.length > 0) continue;

  const url = store.productUrl || `${store.url}?price_min=100&price_max=5000&sort_by=discount`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const pageCashback = await parseStorePageCashback(page);

  store.pageTitle = pageCashback.pageTitle;
  store.earnUptoCashback = pageCashback.earnUptoCashback;
  store.earnUptoText = pageCashback.earnUptoText;
  updated += 1;
  console.log(`${store.slug}: ${pageCashback.earnUptoText ?? 'none'}`);
}

await browser.close();

const out = `${JSON.stringify(json, null, 2)}\n`;
for (const file of files) {
  await writeFile(file, out, 'utf8');
}

console.log(`Updated ${updated} empty-voucher stores`);

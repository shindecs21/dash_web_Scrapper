import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchYahooQuotes, INDEX_SYMBOLS, pickQuote } from './lib/yahoo-quotes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'data', 'markets.json');
const PUBLIC_OUT_FILE = path.join(ROOT, 'public', 'data', 'markets.json');
const WATCHLIST_FILE = path.join(ROOT, 'config', 'markets-watchlist.json');

async function main() {
  const startedAt = new Date().toISOString();
  const watchlistConfig = JSON.parse(await readFile(WATCHLIST_FILE, 'utf8'));

  const symbols = [
    ...INDEX_SYMBOLS.map((i) => i.symbol),
    ...watchlistConfig.map((w) => w.symbol),
  ];

  const quotes = await fetchYahooQuotes(symbols);

  const indices = INDEX_SYMBOLS.map((item) => pickQuote(item, quotes));
  const watchlist = watchlistConfig.map((item) =>
    pickQuote({ id: item.symbol, label: item.label, symbol: item.symbol }, quotes),
  );

  const payload = {
    source: 'yahoo-finance',
    scrapedAt: startedAt,
    marketState: 'regular',
    indices,
    watchlist,
  };

  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await mkdir(path.dirname(PUBLIC_OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, json, 'utf8');
  await writeFile(PUBLIC_OUT_FILE, json, 'utf8');

  console.log(`Wrote ${OUT_FILE}`);
  console.log(
    'Sample:',
    indices.map((i) => `${i.label}: ${i.price} (${i.changePercent?.toFixed(2)}%)`).join(' | '),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

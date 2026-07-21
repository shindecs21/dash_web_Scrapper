import { mapPool } from './map-pool.mjs';

/** @typedef {{ id: string, label: string, symbol: string, price: number | null, change: number | null, changePercent: number | null, currency: string | null }} Quote */

export const INDEX_SYMBOLS = [
  { id: 'nifty', label: 'Nifty 50', symbol: '^NSEI' },
  { id: 'sensex', label: 'Sensex', symbol: '^BSESN' },
  { id: 'bankNifty', label: 'Bank Nifty', symbol: '^NSEBANK' },
  { id: 'usdInr', label: 'USD/INR', symbol: 'INR=X' },
];

const CHART_HOSTS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
];

/**
 * @param {string} symbol
 * @returns {Promise<Quote>}
 */
async function fetchChartQuote(symbol) {
  let lastError = null;

  for (const host of CHART_HOSTS) {
    const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} for ${symbol}`);
        continue;
      }

      const body = await res.json();
      const meta = body?.chart?.result?.[0]?.meta;
      if (!meta) {
        lastError = new Error(`No chart meta for ${symbol}`);
        continue;
      }

      const price = meta.regularMarketPrice ?? null;
      const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
      const change = price != null && previousClose != null ? price - previousClose : null;
      const changePercent =
        change != null && previousClose ? (change / previousClose) * 100 : null;

      return {
        id: symbol,
        label: meta.shortName || meta.longName || meta.symbol || symbol,
        symbol: meta.symbol || symbol,
        price,
        change,
        changePercent,
        currency: meta.currency ?? null,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${symbol}`);
}

/**
 * @param {string[]} symbols
 * @param {number} [concurrency=4]
 * @returns {Promise<Map<string, Quote>>}
 */
export async function fetchYahooQuotes(symbols, concurrency = 4) {
  const unique = [...new Set(symbols)];
  const quotes = await mapPool(unique, concurrency, (symbol) => fetchChartQuote(symbol));
  return new Map(quotes.map((q) => [q.symbol, q]));
}

/**
 * @param {{ id: string, label: string, symbol: string }} item
 * @param {Map<string, Quote>} quotes
 * @returns {Quote}
 */
export function pickQuote(item, quotes) {
  const q = quotes.get(item.symbol);
  return {
    id: item.id,
    label: item.label,
    symbol: item.symbol,
    price: q?.price ?? null,
    change: q?.change ?? null,
    changePercent: q?.changePercent ?? null,
    currency: q?.currency ?? (item.symbol === 'INR=X' ? 'INR' : 'INR'),
  };
}

/** @typedef {{ faceValue: string, type: string, cashback: string, cashbackPercent: number | null, effectivePrice: number | null, validity: string, sellerRating: string | null, rank: number }} Voucher */

/**
 * @param {import('playwright').Page} page
 * @param {number} limit
 * @returns {Promise<Voucher[]>}
 */
export async function parseVouchersFromPage(page, limit = 6) {
  return page.evaluate((max) => {
    const types = ['Offline', 'Online', 'Both'];

    return Array.from(document.querySelectorAll('.gift-card-list-item'))
      .slice(0, max)
      .map((card, index) => {
        const text = card.innerText.replace(/\s+/g, ' ').trim();
        const type =
          types.find((t) => {
            const badge = card.querySelector('.gc-type, .gift-card-type, [class*="gc-type"]');
            if (badge?.innerText?.trim() === t) return true;
            return new RegExp(`\\b${t}\\b`).test(text);
          }) ?? null;

        const faceValue =
          card.querySelector('.seller-info-price .f18, .seller-info-price .f20, .seller-info-price b')?.innerText?.trim() ??
          text.match(/₹[\d,.]+/)?.[0] ??
          null;

        const cashback = text.match(/Cashback:\s*([\d.]+%)/)?.[1] ?? null;
        const cashbackPercent = cashback ? Number(cashback.replace('%', '')) : null;
        const effectiveRaw = text.match(/Effective Price:\s*₹([\d,]+)/)?.[1];
        const effectivePrice = effectiveRaw ? Number(effectiveRaw.replace(/,/g, '')) : null;
        const validity = text.match(/Validity:\s*([A-Za-z0-9 ,]+?)(?:\s+Applicable|\s+Add to cart|$)/)?.[1]?.trim() ?? null;
        const sellerRating = text.match(/^(\d+)\s+₹/)?.[1] ?? null;

        return {
          rank: index + 1,
          faceValue,
          type,
          cashback,
          cashbackPercent,
          effectivePrice,
          validity,
          sellerRating,
        };
      })
      .filter((v) => v.faceValue && v.cashback);
  }, limit);
}

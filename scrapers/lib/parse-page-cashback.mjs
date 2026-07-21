/**
 * Parse official store-page cashback when no user-listed vouchers exist.
 * e.g. "ShemarooMe Gift Cards" + "Earn upto 34% Cashback"
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<{ pageTitle: string | null, earnUptoCashback: string | null, earnUptoText: string | null }>}
 */
export async function parseStorePageCashback(page) {
  return page.evaluate(() => {
    const pageTitle = document.querySelector('h1')?.innerText?.trim() ?? null;
    const earnEl = document.querySelector('.gift-card-cashback');
    const earnUptoText = earnEl?.innerText?.trim() ?? null;
    const bodyMatch = document.body.innerText.match(/Earn\s+upto\s+([\d.]+%)\s*Cashback/i);
    const earnUptoCashback =
      earnUptoText?.match(/([\d.]+%)/)?.[1] ?? bodyMatch?.[1] ?? null;

    return {
      pageTitle,
      earnUptoCashback,
      earnUptoText,
    };
  });
}

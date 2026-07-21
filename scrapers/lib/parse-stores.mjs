/**
 * @param {import('playwright').Page} page
 * @param {number} listingPage
 * @returns {Promise<Array<{ slug: string, name: string, url: string, listingPage: number, listingCashback: string | null }>>}
 */
export async function parseStoresFromListing(page, listingPage = 1) {
  return page.evaluate((pageNum) => {
    const slugPattern = /\/gift-cards\/([a-z0-9-]+)\/?(?:\?|$|#)/i;
    const ordered = [];
    const seen = new Set();

    for (const card of document.querySelectorAll('.card.pr')) {
      const anchor = card.querySelector('a[href*="/gift-cards/"]');
      if (!anchor || anchor.classList.contains('submenu-links')) continue;

      const href = anchor.getAttribute('href') ?? '';
      const match = href.match(slugPattern);
      if (!match) continue;

      const slug = match[1];
      if (seen.has(slug)) continue;

      const cardText = card.innerText.replace(/\s+/g, ' ').trim();
      const name =
        card.querySelector('img')?.getAttribute('alt')?.trim() ||
        card.querySelector('.card-footer, .gc-ptrn')?.innerText?.trim().split('\n')[0] ||
        anchor.innerText.trim().split('\n')[0]?.trim() ||
        slug;

      const listingCashback =
        cardText.match(/(\d+(?:\.\d+)?)\s*%\s*(?:Cashback|cashback)/i)?.[1] ??
        cardText.match(/Upto\s*(\d+(?:\.\d+)?)\s*%/i)?.[1] ??
        null;

      seen.add(slug);
      ordered.push({
        slug,
        name,
        url: `https://www.zingoy.com/gift-cards/${slug}`,
        listingPage: pageNum,
        listingCashback: listingCashback ? `${listingCashback}%` : null,
      });
    }

    return ordered;
  }, listingPage);
}

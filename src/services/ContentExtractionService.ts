// Simple HTML content extractor with privacy-conscious heuristics.
// Avoids external libs to keep bundle small. We can swap in readability if needed later.

export interface ExtractionResult {
  title?: string;
  text: string;
}

function getMainTextFromDocument(doc: Document): string {
  try {
    // Prefer <main> or article-like containers; fallback to body text.
    const main = doc.querySelector('main, article, [role="main"], .content, .post, .article');
    const container = (main as HTMLElement) || doc.body;
    // Clone to remove scripts/styles/nav/aside/ads.
    const clone = container.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, nav, aside, footer, header, noscript, iframe').forEach((n) => n.remove());
    // Remove elements that are obviously non-content by common class hints.
    clone.querySelectorAll('[class*="sidebar"], [class*="advert"], [id*="sidebar"], [id*="advert"]').forEach((n) => n.remove());
    const text = clone.innerText || '';
    return text.replace(/\s+/g, ' ').trim();
  } catch {
    return (doc.body?.innerText || '').replace(/\s+/g, ' ').trim();
  }
}

export const ContentExtractionService = {
  extractFromCurrentPage(): ExtractionResult {
    const title = document.title || undefined;
    const text = getMainTextFromDocument(document);
    return { title, text };
  }
};



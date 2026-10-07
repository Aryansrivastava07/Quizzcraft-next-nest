/**
 * Lightweight web scraper for URL-based quiz generation.
 * Extracts clean article text and verified page images (og:image, article figures)
 * without heavy headless browser dependencies.
 */

export interface ScrapedWebContent {
  url: string;
  title: string;
  text: string;
  imageUrls: string[];
}

export async function scrapeWebContent(url: string): Promise<ScrapedWebContent | null> {
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
    return null;
  }

  const cleanUrl = url.trim();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 QuizzCraft/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // 1. Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // 2. Extract verified image URLs
    const imageUrls: string[] = [];

    // Check og:image
    const ogImageMatch = html.match(
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
    ) || html.match(
      /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
    );
    if (ogImageMatch && ogImageMatch[1]) {
      imageUrls.push(resolveAbsoluteUrl(cleanUrl, ogImageMatch[1]));
    }

    // Check twitter:image
    const twitterImageMatch = html.match(
      /<meta\s+(?:name|property)=["']twitter:image["']\s+content=["']([^"']+)["']/i,
    );
    if (twitterImageMatch && twitterImageMatch[1]) {
      const full = resolveAbsoluteUrl(cleanUrl, twitterImageMatch[1]);
      if (!imageUrls.includes(full)) imageUrls.push(full);
    }

    // Check article images
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = imgRegex.exec(html)) !== null && count < 6) {
      const src = match[1];
      if (
        src &&
        !src.includes('data:image') &&
        !src.includes('.svg') &&
        !src.includes('pixel') &&
        !src.includes('tracker') &&
        !src.includes('avatar') &&
        !src.includes('icon')
      ) {
        const full = resolveAbsoluteUrl(cleanUrl, src);
        if (!imageUrls.includes(full)) {
          imageUrls.push(full);
          count++;
        }
      }
    }

    // 3. Clean and extract article text
    let cleanText = html
      // Remove scripts and styles
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      // Remove headers, navs, footers
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      // Strip all remaining HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();

    return {
      url: cleanUrl,
      title,
      text: cleanText.slice(0, 15000),
      imageUrls: imageUrls.slice(0, 5),
    };
  } catch (error) {
    console.warn(`[scrapeWebContent] Failed to scrape ${cleanUrl}:`, error);
    return null;
  }
}

function resolveAbsoluteUrl(baseUrl: string, relativeOrAbsolute: string): string {
  try {
    return new URL(relativeOrAbsolute, baseUrl).href;
  } catch {
    return relativeOrAbsolute;
  }
}

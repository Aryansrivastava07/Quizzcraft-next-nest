/**
 * Utility for resolving high-quality, verified topic-related images for quizzes.
 * Does NOT prompt AI to generate/hallucinate image URLs.
 * 
 * Strategy:
 * 1. Query Wikipedia PageImages API (returns real, permanent Wikimedia CDN images).
 * 2. If not found, query Wikimedia Commons search API.
 * 3. Fallback to topic-matched curated CDN collections (Unsplash royalty-free HD photos).
 * 4. Default to aesthetic cosmic cyberpunk void artwork.
 */

interface CuratedPreset {
  keywords: string[];
  url: string;
}

const CURATED_CATEGORY_PRESETS: CuratedPreset[] = [
  {
    keywords: ['quantum', 'physics', 'relativity', 'mechanics', 'particle', 'gravity', 'thermodynamics'],
    url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80', // Quantum energy field
  },
  {
    keywords: ['astronomy', 'space', 'cosmos', 'universe', 'galaxy', 'planet', 'mars', 'telescope', 'nasa'],
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80', // Earth from orbit
  },
  {
    keywords: ['computer', 'programming', 'coding', 'software', 'developer', 'algorithm', 'python', 'javascript', 'cyber', 'network', 'database', 'linux'],
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80', // Cyber code matrix
  },
  {
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'neural', 'deep learning', 'robotics'],
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80', // AI neural pattern
  },
  {
    keywords: ['biology', 'cell', 'genetics', 'dna', 'microbiology', 'anatomy', 'medicine', 'physiology', 'bacteria', 'virus'],
    url: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=1200&q=80', // DNA helix
  },
  {
    keywords: ['chemistry', 'chemical', 'molecule', 'atom', 'reaction', 'organic', 'periodic', 'acid'],
    url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80', // Lab glassware
  },
  {
    keywords: ['math', 'mathematics', 'algebra', 'calculus', 'geometry', 'statistics', 'equation', 'number'],
    url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1200&q=80', // Mathematical geometry
  },
  {
    keywords: ['history', 'ancient', 'war', 'revolution', 'empire', 'rome', 'greece', 'egypt', 'medieval', 'civilization'],
    url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1200&q=80', // Ancient scrolls & compass
  },
  {
    keywords: ['geography', 'earth', 'ocean', 'mountain', 'country', 'continent', 'map', 'climate'],
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', // Scenic nature
  },
  {
    keywords: ['literature', 'book', 'novel', 'poetry', 'philosophy', 'shakespeare', 'reading', 'author', 'language', 'grammar'],
    url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80', // Library of knowledge
  },
  {
    keywords: ['business', 'finance', 'economics', 'marketing', 'management', 'money', 'stock', 'crypto'],
    url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80', // Stock charts & business
  },
  {
    keywords: ['gaming', 'game', 'esports', 'arcade', 'video game', 'rpg', 'console'],
    url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80', // Cyber gaming battlestation
  },
  {
    keywords: ['art', 'music', 'painting', 'design', 'drawing', 'artist', 'theater', 'cinema'],
    url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80', // Artistic paint synthesis
  },
];

const DEFAULT_COSMIC_IMAGE =
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80'; // Quantum microprocessor & cyber glow

/**
 * Extracts a concise search keyword string from a quiz title or prompt
 */
export function extractCleanQuery(title: string, prompt?: string): string {
  const raw = `${title || ''} ${prompt || ''}`.trim();
  // Strip common noisy quiz filler words
  return raw
    .replace(/\b(quiz|exam|test|questions?|mcqs?|overview|introduction to|fundamentals of|basics of|advanced|principles of|complete guide|practice|assessment)\b/gi, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/**
 * Resolves a related image URL for a quiz without relying on AI hallucinations
 */
export async function resolveQuizRelatedImage(
  title: string,
  prompt?: string,
): Promise<string> {
  const cleanQuery = extractCleanQuery(title, prompt) || title.trim();

  // 1. Try Wikipedia PageImages API
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      cleanQuery,
    )}&gsrlimit=1&prop=pageimages&pithumbsize=1000&format=json&origin=*`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(wikiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'QuizzCraft/1.0 (educational quiz platform; contact@quizzcraft.app)',
      },
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const pages = data?.query?.pages;
      if (pages && typeof pages === 'object') {
        const firstPage: any = Object.values(pages)[0];
        if (firstPage?.thumbnail?.source) {
          return firstPage.thumbnail.source;
        }
      }
    }
  } catch (err) {
    // Wikipedia query timed out or failed, fall through to fallback
  }

  // 2. Try Wikimedia Commons search
  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      cleanQuery,
    )}&gsrlimit=1&prop=pageimages&pithumbsize=1000&format=json&origin=*`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(commonsUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'QuizzCraft/1.0 (educational quiz platform; contact@quizzcraft.app)',
      },
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const pages = data?.query?.pages;
      if (pages && typeof pages === 'object') {
        const firstPage: any = Object.values(pages)[0];
        if (firstPage?.thumbnail?.source) {
          return firstPage.thumbnail.source;
        }
      }
    }
  } catch (err) {
    // Commons search failed, continue to curated presets
  }

  // 3. Fallback: Match against curated high-definition royalty-free category imagery
  const normalizedText = `${title} ${prompt || ''}`.toLowerCase();
  for (const preset of CURATED_CATEGORY_PRESETS) {
    if (preset.keywords.some((kw) => normalizedText.includes(kw))) {
      return preset.url;
    }
  }

  // 4. Default cosmic aesthetic banner
  return DEFAULT_COSMIC_IMAGE;
}

/**
 * Utility for resolving high-quality, verified topic-related images for quizzes.
 * Does NOT prompt AI to generate/hallucinate image URLs.
 *
 * Strategy:
 * 1. Extract intelligent topic candidates (e.g. primary entity before subtitles, clean title, domain keywords).
 * 2. Query Wikipedia REST Summary API (returns high-resolution, verified Wikimedia CDN media).
 * 3. Query Wikipedia REST Search API to find related articles with verified thumbnail imagery.
 * 4. Fallback to Wikimedia Action & Commons Search APIs.
 * 5. Fallback to curated topic-matched CDN presets (Sports, Cricket, Science, History, Tech, etc.).
 * 6. Default to aesthetic cosmic knowledge portal banner (never a random circuit board!).
 */

interface CuratedPreset {
  keywords: string[];
  url: string;
}

const CURATED_CATEGORY_PRESETS: CuratedPreset[] = [
  {
    // Sports, Cricket, Athletes, Arenas
    keywords: [
      'cricket', 'dhoni', 'ipl', 'batsman', 'bowler', 'wicket', 'football',
      'soccer', 'basketball', 'tennis', 'sports', 'athlete', 'stadium',
      'olympics', 'fifa', 'nba', 'messi', 'ronaldo', 'virat', 'match',
    ],
    url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80', // Floodlit stadium arena
  },
  {
    // Physics, Space, Astronomy, Cosmology
    keywords: [
      'quantum', 'physics', 'relativity', 'mechanics', 'particle', 'gravity',
      'thermodynamics', 'astronomy', 'space', 'cosmos', 'universe', 'galaxy',
      'planet', 'mars', 'telescope', 'nasa', 'astrophysics',
    ],
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80', // Cosmic nebula & orbital globe
  },
  {
    // Computer Science, Programming, Software, Systems
    keywords: [
      'computer', 'programming', 'coding', 'software', 'developer', 'algorithm',
      'python', 'javascript', 'typescript', 'cyber', 'network', 'database',
      'linux', 'operating system', 'backend', 'frontend', 'docker', 'devops',
    ],
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80', // Cyber code matrix
  },
  {
    // Artificial Intelligence & Machine Learning
    keywords: [
      'ai', 'artificial intelligence', 'machine learning', 'neural', 'deep learning',
      'robotics', 'llm', 'computer vision', 'nlp', 'automation',
    ],
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80', // AI neural pattern
  },
  {
    // Biology, Medicine, Anatomy, Genetics
    keywords: [
      'biology', 'cell', 'genetics', 'dna', 'microbiology', 'anatomy', 'medicine',
      'physiology', 'bacteria', 'virus', 'biochemistry', 'organism', 'evolution',
    ],
    url: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=1200&q=80', // DNA double helix
  },
  {
    // Chemistry & Laboratory
    keywords: [
      'chemistry', 'chemical', 'molecule', 'atom', 'reaction', 'organic',
      'periodic', 'acid', 'compound', 'laboratory', 'element',
    ],
    url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80', // Laboratory glassware
  },
  {
    // Mathematics, Geometry, Statistics
    keywords: [
      'math', 'mathematics', 'algebra', 'calculus', 'geometry', 'statistics',
      'equation', 'number', 'probability', 'theorem',
    ],
    url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1200&q=80', // Mathematical geometry
  },
  {
    // History, Wars, Civilizations
    keywords: [
      'history', 'ancient', 'war', 'revolution', 'empire', 'rome', 'greece',
      'egypt', 'medieval', 'civilization', 'historical', 'monarch', 'dynasty',
    ],
    url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1200&q=80', // Ancient historical artifacts & scrolls
  },
  {
    // Geography, Earth, Nature, Oceans
    keywords: [
      'geography', 'earth', 'ocean', 'mountain', 'country', 'continent',
      'map', 'climate', 'river', 'geology', 'environment', 'planet',
    ],
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', // Scenic nature & horizon
  },
  {
    // Literature, Philosophy, Languages, Books
    keywords: [
      'literature', 'book', 'novel', 'poetry', 'philosophy', 'shakespeare',
      'reading', 'author', 'language', 'grammar', 'fiction', 'prose',
    ],
    url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80', // Grand library of books
  },
  {
    // Business, Finance, Economics
    keywords: [
      'business', 'finance', 'economics', 'marketing', 'management', 'money',
      'stock', 'crypto', 'investment', 'enterprise', 'trade',
    ],
    url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80', // Financial analytics & charts
  },
  {
    // Gaming & Esports
    keywords: [
      'gaming', 'game', 'esports', 'arcade', 'video game', 'rpg', 'console',
      'playstation', 'xbox', 'nintendo', 'gamer',
    ],
    url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80', // Gaming battlestation
  },
  {
    // Arts, Music, Cinema
    keywords: [
      'art', 'music', 'painting', 'design', 'drawing', 'artist', 'theater',
      'cinema', 'film', 'movie', 'sculpture', 'composer',
    ],
    url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80', // Artistic paint canvas
  },
  {
    // General Education, Academics, Exams, Studying
    keywords: [
      'education', 'school', 'university', 'college', 'student', 'study',
      'learning', 'quiz', 'exam', 'test', 'academic', 'knowledge',
    ],
    url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80', // Academic books & desk
  },
];

// Beautiful cosmic knowledge portal banner (NOT a computer circuit board!)
const DEFAULT_COSMIC_IMAGE =
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80'; // Celestial twilight & starry sky

/**
 * Extracts high-confidence search candidate queries in prioritized order
 */
export function getCandidateQueries(title: string, prompt?: string): string[] {
  const candidates: string[] = [];

  if (title && title.trim()) {
    // 1. Primary entity/subject before punctuation (e.g. "Mahendra Singh Dhoni: Career..." -> "Mahendra Singh Dhoni")
    const primarySubject = title.split(/[:\-\–\—\|•]/)[0].trim();
    if (primarySubject.length >= 2) {
      candidates.push(primarySubject);
    }

    // 2. Cleaned title with noisy filler terms removed
    const cleanTitle = title
      .replace(
        /\b(quiz|exam|test|questions?|mcqs?|overview|introduction to|fundamentals of|basics of|advanced|principles of|complete guide|practice|assessment|milestones?|legacy)\b/gi,
        ' ',
      )
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanTitle && !candidates.includes(cleanTitle)) {
      candidates.push(cleanTitle);
    }
  }

  // 3. User prompt subject if not a generic filler prompt
  if (prompt && prompt.trim() && prompt.length < 250) {
    const cleanPrompt = prompt
      .replace(
        /\b(create|generate|write|make|quiz|test|exam|assessment|mcq|mcqs|about|on|covering|with|\d+\s*questions?|high-yield|comprehensive)\b/gi,
        ' ',
      )
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanPrompt.length >= 3 && !candidates.includes(cleanPrompt)) {
      candidates.push(cleanPrompt);
    }
  }

  return candidates;
}

/**
 * Validates that an image URL is a real photograph/media and not a tiny icon or broken SVG
 */
function isValidMediaUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  if (lower.endsWith('.svg') || lower.includes('.svg/')) return false;
  if (
    lower.includes('disambig') ||
    lower.includes('question_book') ||
    lower.includes('commons-logo') ||
    lower.includes('red_pencile') ||
    lower.includes('padlock') ||
    lower.includes('edit-clear')
  ) {
    return false;
  }
  return true;
}

/**
 * Resolves a related image URL for a quiz without relying on AI hallucinations
 */
export async function resolveQuizRelatedImage(
  title: string,
  prompt?: string,
): Promise<string> {
  const candidates = getCandidateQueries(title, prompt);
  if (candidates.length === 0) {
    candidates.push(title.trim());
  }

  const userAgent = 'QuizzCraft/1.0 (educational quiz platform; contact@quizzcraft.app)';

  // Iterate over candidates in priority order
  for (const candidate of candidates) {
    // 1. Try Wikipedia REST Summary API (returns high-res image & handles redirects)
    try {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        candidate,
      )}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2800);

      const res = await fetch(summaryUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': userAgent },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const imgUrl = data.originalimage?.source || data.thumbnail?.source;
        if (isValidMediaUrl(imgUrl)) {
          return imgUrl;
        }
      }
    } catch (e) {
      // Continue to search
    }

    // 2. Try Wikipedia REST Search API (finds related topic pages with thumbnails)
    try {
      const searchUrl = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(
        candidate,
      )}&limit=4`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(searchUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': userAgent },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.pages)) {
          const matchedPage = data.pages.find((p: any) =>
            isValidMediaUrl(p.thumbnail?.url),
          );
          if (matchedPage?.thumbnail?.url) {
            let thumbUrl = matchedPage.thumbnail.url;
            if (thumbUrl.startsWith('//')) {
              thumbUrl = 'https:' + thumbUrl;
            }
            // Scale thumbnail up from tiny 60px icon to crisp 800px HD
            return thumbUrl.replace(/\/\d+px-/, '/800px-');
          }
        }
      }
    } catch (e) {
      // Continue
    }

    // 3. Try Wikipedia Action API (PageImages generator)
    try {
      const wikiActionUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        candidate,
      )}&gsrlimit=3&prop=pageimages&pithumbsize=1000&format=json&origin=*`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(wikiActionUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': userAgent },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const pages = data?.query?.pages;
        if (pages && typeof pages === 'object') {
          for (const page of Object.values(pages) as any[]) {
            const src = page?.thumbnail?.source;
            if (isValidMediaUrl(src)) {
              return src;
            }
          }
        }
      }
    } catch (e) {
      // Continue
    }
  }

  // 4. Fallback: Match against comprehensive curated royalty-free HD imagery
  const normalizedText = `${title || ''} ${prompt || ''}`.toLowerCase();
  for (const preset of CURATED_CATEGORY_PRESETS) {
    if (preset.keywords.some((kw) => normalizedText.includes(kw))) {
      return preset.url;
    }
  }

  // 5. Default aesthetic cosmic knowledge portal
  return DEFAULT_COSMIC_IMAGE;
}

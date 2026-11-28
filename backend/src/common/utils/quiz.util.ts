/**
 * Utility to verify if a user's answer matches the target answer.
 * Handles exact text, choice indices (0-indexed or 1-indexed), and choice letters ('A', 'B', 'C', 'D').
 */
export function checkIsCorrect(
  userChosen: string | undefined | null,
  rawAnswer: string | undefined | null,
  options: string[] = [],
): boolean {
  if (!userChosen || rawAnswer === undefined || rawAnswer === null) return false;
  const u = String(userChosen).trim().toLowerCase();
  const c = String(rawAnswer).trim().toLowerCase();
  if (u === c) return true;

  const optIdx = options.findIndex((opt) => String(opt).trim().toLowerCase() === u);
  if (optIdx >= 0) {
    if (String(optIdx) === c) return true;
    if (String(optIdx + 1) === c) return true;
    const letter = ['a', 'b', 'c', 'd', 'e'][optIdx];
    if (letter && letter === c) return true;
  }
  return false;
}

/**
 * Intelligent topic extractor and classifier for assessments.
 * Uses title, question stems, and explanations to categorize into clean academic/subject areas.
 */
export function deriveTopic(title?: string, questions?: any[]): string {
  const text = `${title || ''} ${questions?.[0]?.question || ''} ${questions?.[0]?.explanation || ''}`.toLowerCase();

  if (/quantum|relativity|physics|astronomy|cosmos|mechanics|gravity|thermodynamics|particle|galaxy|telescope|nasa|electromagnetism/.test(text)) {
    return 'Physics & Space';
  }
  if (/code|coding|software|programming|python|javascript|typescript|react|angular|node|docker|kubernetes|backend|frontend|database|sql|algorithm|linux|git\b|html|css|data structure/.test(text)) {
    return 'Computer Science';
  }
  if (/\bai\b|artificial intelligence|machine learning|deep learning|neural|llm|robotics|nlp|vision|chatgpt|openai/.test(text)) {
    return 'AI & Data Science';
  }
  if (/biology|genetics|dna|cell\b|anatomy|medicine|medical|virus|bacteria|organism|evolution|physiology|immunology|biotech/.test(text)) {
    return 'Biology & Medicine';
  }
  if (/chemistry|chemical|molecule|acid|organic chemistry|compound|reaction|periodic table|atom|polymer|bond/.test(text)) {
    return 'Chemistry';
  }
  if (/math|algebra|calculus|geometry|trigonometry|statistic|probability|equation|matrix|theorem|arithmetic/.test(text)) {
    return 'Mathematics';
  }
  if (/history|war\b|civilization|empire|ancient|medieval|revolution|dynasty|president|monarchy|renaissance|archaeology/.test(text)) {
    return 'History & Civilization';
  }
  if (/business|finance|market|economy|stock|invest|accounting|banking|commerce|marketing|management|startup/.test(text)) {
    return 'Business & Economics';
  }
  if (/literature|poetry|novel|shakespeare|author|grammar|english|linguistics|prose|fiction|essay/.test(text)) {
    return 'Literature & Arts';
  }
  if (/geography|continent|ocean|climate|mountain|country|capital|earth|geology|ecosystem|environment/.test(text)) {
    return 'Earth & Geography';
  }
  if (/cricket|football|soccer|basketball|sports|tennis|olympic|fifa|ipl|athlete|stadium|baseball|badminton/.test(text)) {
    return 'Sports & Athletics';
  }

  // If title has a clean, meaningful name (e.g. "Cellular Respiration", "Linear Algebra"), extract first 2-3 words
  if (title && title.trim().length > 3 && !title.toLowerCase().includes('generated') && !title.toLowerCase().includes('untitled')) {
    const cleaned = title.replace(/^(quiz on|test on|quiz about|introduction to|fundamentals of|basics of|mastering|overview of)\s+/i, '').trim();
    if (cleaned.length > 2) {
      const words = cleaned.split(/\s+/).slice(0, 3).join(' ');
      return words.charAt(0).toUpperCase() + words.slice(1);
    }
  }

  return 'General Knowledge';
}

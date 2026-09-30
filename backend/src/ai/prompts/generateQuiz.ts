import { generateQuizDto } from '../../quiz/dto/quiz.request.dto';

export const quizCreationSchema = {
  type: 'object',
  properties: {
    quiz: {
      type: 'object',
      description: 'The quiz object containing a title and a list of questions.',
      properties: {
        title: {
          type: 'string',
          description: 'A captivating, academic, or competitive title for the quiz.',
        },
        questions: {
          type: 'array',
          description: 'A list of quiz questions.',
          items: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'The question statement.',
              },
              options: {
                type: 'array',
                description: 'Array of answer choices.',
                items: {
                  type: 'string',
                },
              },
              answer: {
                type: 'integer',
                description: 'The 0-based index of the correct answer in the options array.',
              },
              explanation: {
                type: 'string',
                description: 'Clear, concise explanation for why the answer is correct.',
              },
              level: {
                type: 'string',
                enum: ['EASY', 'MEDIUM', 'HARD'],
                description: 'Difficulty tier: EASY, MEDIUM, or HARD.',
              },
              xp: {
                type: 'integer',
                description: 'XP awarded: 100 (EASY), 200 (MEDIUM), or 300 (HARD).',
              },
            },
            required: ['question', 'options', 'answer', 'explanation'],
          },
        },
      },
      required: ['title', 'questions'],
    },
  },
  required: ['quiz'],
};

export const generateQuizPrompt = (input: generateQuizDto | string) => {
  const dto: Partial<generateQuizDto> =
    typeof input === 'string' ? { prompt: input } : input || {};

  const promptText = dto.prompt?.trim() || 'General Knowledge and Applied Science';
  const rawCount = Number(dto.questionCount);
  const count = !isNaN(rawCount) && rawCount > 0 ? Math.min(30, Math.max(1, rawCount)) : 10;
  const difficulty = dto.difficulty?.trim() || 'Intermediate';
  const quizType = dto.quizType?.trim() || 'Multiple Choice';
  const sourceUrl = dto.sourceUrl?.trim() ? `\n- Reference/Source URL: ${dto.sourceUrl.trim()}` : '';

  // Difficulty tailored guidance
  let difficultyGuidance = '';
  const diffLower = difficulty.toLowerCase();
  if (diffLower.includes('beginner')) {
    difficultyGuidance = `
- Target Difficulty: BEGINNER (Foundational).
- Emphasize foundational definitions, essential terminology, core concepts, and direct factual comprehension.
- All or most questions should have level "EASY" (100 XP), with a few introductory "MEDIUM" questions (200 XP).`;
  } else if (diffLower.includes('advanced')) {
    difficultyGuidance = `
- Target Difficulty: ADVANCED (High Rigor).
- Emphasize multi-step problem solving, in-depth mechanics, critical edge cases, counterintuitive proofs, and rigorous conceptual analysis.
- Questions should be tagged primarily "HARD" (300 XP) and challenging "MEDIUM" (200 XP).`;
  } else if (diffLower.includes('adaptive')) {
    const easyCount = Math.max(1, Math.round(count * 0.3));
    const medCount = Math.max(1, Math.round(count * 0.4));
    difficultyGuidance = `
- Target Difficulty: ADAPTIVE AI (Progressive Difficulty Curve).
- Questions 1 to ${easyCount}: Foundational "EASY" questions (100 XP).
- Questions ${easyCount + 1} to ${easyCount + medCount}: Intermediate "MEDIUM" application questions (200 XP).
- Remaining questions: Advanced "HARD" multi-concept evaluation questions (300 XP).`;
  } else {
    difficultyGuidance = `
- Target Difficulty: INTERMEDIATE (Standard Academic).
- Balanced mix of conceptual comprehension, practical application, and standard academic problem-solving.
- Include an even distribution across "EASY" (100 XP), "MEDIUM" (200 XP), and "HARD" (300 XP).`;
  }

  // Format tailored guidance
  let formatGuidance = '';
  const typeLower = quizType.toLowerCase();
  if (typeLower.includes('true')) {
    formatGuidance = `
- Question Format: TRUE / FALSE BLITZ.
- Every question must have exactly 2 options: ["True", "False"].
- Craft sharp, definitive statements that test common misconceptions, factual boundaries, or critical assertions.`;
  } else if (typeLower.includes('mixed')) {
    formatGuidance = `
- Question Format: MIXED FORMAT.
- Combine standard 4-option Multiple Choice questions with insightful 2-option True/False scenario evaluations.`;
  } else {
    formatGuidance = `
- Question Format: MULTIPLE CHOICE (MCQ).
- Every question must provide exactly 4 distinct, plausible options.
- Exactly one correct answer; the 3 distractors should be plausible misconceptions, definitively incorrect under scrutiny.`;
  }

  return `
You are an elite educational assessment architect and competitive quiz designer. Your task is to generate an engaging, pedagogically rigorous, and 100% factually accurate quiz based on the provided topic, instructions, and content.

**User's Topic & Custom Instructions:**
${promptText}${sourceUrl}

**Quiz Specifications & Requirements:**
1. **Total Questions:** Generate exactly ${count} questions.
2. **Difficulty Profile:** ${difficulty}
${difficultyGuidance}
3. **Format Profile:** ${quizType}
${formatGuidance}

**Core Pedagogical Rules:**
1. **Multimodal Media Grounding:**
   - If documents (PDFs, notes), diagrams/images, or video files are attached with this request, analyze their full visual, textual, mathematical, and conceptual contents thoroughly.
   - Ground the questions directly in the facts, formulas, principles, architectures, and diagrams presented in the attached files.
2. **Factual Integrity:** Every question and answer must be strictly accurate, unambiguous, and rooted in established science/facts.
3. **Explanations:** Each question MUST include a concise, high-value "explanation" explaining why the correct answer is true and clarifying any common misjudgments.
3. **Question Metadata:**
   - "level": Must be exactly "EASY", "MEDIUM", or "HARD".
   - "xp": Must be 100 for EASY, 200 for MEDIUM, or 300 for HARD.
4. **Answer Index:**
   - "answer": 0-based integer index corresponding to the correct option in the "options" array.

**Output Format (Strict):**
- Output a single JSON object.
- The root object must have a "quiz" key.
- Adhere strictly to this schema:
${JSON.stringify(quizCreationSchema)}
`;
};

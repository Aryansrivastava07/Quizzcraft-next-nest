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
              reference: {
                type: 'object',
                description: 'Visual reference anchor linking this question to the source material or conceptual diagram without spoiling the answer.',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['IMAGE', 'VIDEO_FRAME', 'PDF_PAGE', 'WEB_SOURCE', 'VERIFIED_CDN'],
                    description: 'Reference type: IMAGE (from uploaded images), VIDEO_FRAME (from uploaded video), PDF_PAGE (from uploaded PDF), WEB_SOURCE (from URL), or VERIFIED_CDN (concept keyword for text).',
                  },
                  sourceIndex: {
                    type: 'integer',
                    description: '0-based index of the uploaded file referenced (e.g. 0 for first image).',
                  },
                  timestamp: {
                    type: 'string',
                    description: 'Video timestamp in MM:SS format if referencing a video (e.g. "01:45").',
                  },
                  pageNumber: {
                    type: 'integer',
                    description: '1-based page number if referencing a PDF document.',
                  },
                  caption: {
                    type: 'string',
                    description: 'Contextual educational caption for the exhibit (e.g., "Figure 2: Experimental setup diagram" or "Video Lecture Snapshot at 02:14: Newton\'s Third Law demonstration"). MUST NEVER state or hint at the answer!',
                  },
                  searchKeyword: {
                    type: 'string',
                    description: '2 to 4 academic/scientific keywords to retrieve a verified diagram from Wikipedia/Wikimedia if no local diagram was provided (e.g. "mitochondria structure", "Bloch sphere", "Doppler effect").',
                  },
                },
                required: ['type', 'caption'],
              },
            },
            required: ['question', 'options', 'answer', 'explanation', 'reference'],
          },
        },
      },
      required: ['title', 'questions'],
    },
  },
  required: ['quiz'],
};

export const generateQuizPrompt = (
  input: generateQuizDto | string,
  extraContext?: {
    uploadedImages?: { index: number; name: string }[];
    uploadedVideos?: { index: number; name: string }[];
    uploadedPdfs?: { index: number; name: string }[];
    scrapedUrlText?: string;
  },
) => {
  const dto: Partial<generateQuizDto> =
    typeof input === 'string' ? { prompt: input } : input || {};

  const promptText = dto.prompt?.trim() || 'General Knowledge and Applied Science';
  const rawCount = Number(dto.questionCount);
  const count = !isNaN(rawCount) && rawCount > 0 ? Math.min(30, Math.max(1, rawCount)) : 10;
  const difficulty = dto.difficulty?.trim() || 'Intermediate';
  const quizType = dto.quizType?.trim() || 'Multiple Choice';
  const sourceUrl = dto.sourceUrl?.trim() ? `\n- Reference/Source URL: ${dto.sourceUrl.trim()}` : '';

  // Attached files description
  const attachedMediaLines: string[] = [];
  if (extraContext?.uploadedImages && extraContext.uploadedImages.length > 0) {
    extraContext.uploadedImages.forEach((img) => {
      attachedMediaLines.push(`  - Uploaded Image [index ${img.index}]: "${img.name}"`);
    });
  }
  if (extraContext?.uploadedVideos && extraContext.uploadedVideos.length > 0) {
    extraContext.uploadedVideos.forEach((vid) => {
      attachedMediaLines.push(`  - Uploaded Video [index ${vid.index}]: "${vid.name}"`);
    });
  }
  if (extraContext?.uploadedPdfs && extraContext.uploadedPdfs.length > 0) {
    extraContext.uploadedPdfs.forEach((pdf) => {
      attachedMediaLines.push(`  - Uploaded Document [index ${pdf.index}]: "${pdf.name}"`);
    });
  }

  const mediaManifest =
    attachedMediaLines.length > 0
      ? `\n**Attached User Files (Grounding Manifest):**\n${attachedMediaLines.join('\n')}\n`
      : '';

  const webContentSection = extraContext?.scrapedUrlText
    ? `\n**Extracted Web Page Content (from ${dto.sourceUrl}):**\n${extraContext.scrapedUrlText.slice(0, 12000)}\n`
    : '';

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
${mediaManifest}
${webContentSection}

**Quiz Specifications & Requirements:**
1. **Total Questions:** Generate exactly ${count} questions.
2. **Difficulty Profile:** ${difficulty}
${difficultyGuidance}
3. **Format Profile:** ${quizType}
${formatGuidance}

**Core Pedagogical & Multimodal Grounding Rules:**
1. **Source Grounding & Exhibit References:**
   - If IMAGES are attached: Link questions to the specific uploaded image using type "IMAGE" and sourceIndex (0, 1, ...). Provide a caption describing the exhibit without stating the solution.
   - If a VIDEO is attached: Identify the precise moment where the concept is taught. Use type "VIDEO_FRAME", timestamp (e.g. "01:45"), and a caption (e.g. "Scene at 01:45: Magnetic induction apparatus").
   - If a PDF is attached: Ground the question in the document. Use type "PDF_PAGE", pageNumber (e.g. 4), and a caption (e.g. "Section 2.4 — Thermodynamic cycle").
   - If a WEB URL was provided: Ground questions in the extracted article text, and use type "WEB_SOURCE" or "VERIFIED_CDN".
   - If text-only or general topic: Use type "VERIFIED_CDN" and provide a 2 to 4 word academic searchKeyword (e.g. "Bloch sphere qubit", "mitochondria structure", "Doppler shift sound") so our verified Wikipedia/Wikimedia engine can display a real, permanent educational diagram.

2. **CRITICAL ANTI-SPOILER RULE (ZERO ANSWER LEAKAGE):**
   - The reference exhibit, frame, page, and caption are educational context ONLY.
   - The caption and visual reference MUST NEVER state, label, circle, highlight, or reveal which option is correct!
   - NEVER put the correct answer in the caption. (e.g. Do NOT say: "Figure showing that option B is correct").
   - For diagrams with visible answers, ask about an unlabelled component, underlying principle, or consequence, rather than asking to read off what is visibly written.

3. **Factual Integrity:** Every question and answer must be strictly accurate, unambiguous, and rooted in established science/facts.
4. **Explanations:** Each question MUST include a concise, high-value "explanation" explaining why the correct answer is true and clarifying any common misjudgments.
5. **Question Metadata:**
   - "level": Must be exactly "EASY", "MEDIUM", or "HARD".
   - "xp": Must be 100 for EASY, 200 for MEDIUM, or 300 for HARD.
6. **Answer Index:**
   - "answer": 0-based integer index corresponding to the correct option in the "options" array.

**Output Format (Strict):**
- Output a single JSON object.
- The root object must have a "quiz" key.
- Adhere strictly to this schema:
${JSON.stringify(quizCreationSchema)}
`;
};

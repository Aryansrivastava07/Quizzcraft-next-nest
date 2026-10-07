import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiError,
  createPartFromUri,
  createUserContent,
  GoogleGenAI,
} from '@google/genai';
import { AiProvider } from '../interfaces/ai-provider.interface';
import { generateQuizDto } from '../../quiz/dto/quiz.request.dto';
import {
  generateQuizPrompt,
  quizCreationSchema,
} from '../prompts/generateQuiz';
import {
  getFilesFromDto,
  UploadedFileWithMime,
} from '../../common/utils/genFiles.util';
import { IAiGeneratedQuizResponse } from '../../common/interfaces/quiz.interface';
import { resolveQuizRelatedImage } from '../../quiz/utils/quiz-image.util';
import { scrapeWebContent, ScrapedWebContent } from '../../quiz/utils/url-scraper.util';

@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new GoogleGenAI({
      apiKey: this.configService.getOrThrow<string>('GEMINI_API_KEY'),
    });

    this.model =
      this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite';
  }

  async generateQuiz(dto: generateQuizDto): Promise<IAiGeneratedQuizResponse> {
    let fileParts: any[] = [];
    let geminiUploads: any[] = [];
    let uploads: UploadedFileWithMime[] = [];
    let imageUploads: UploadedFileWithMime[] = [];
    let videoUploads: UploadedFileWithMime[] = [];
    let pdfUploads: UploadedFileWithMime[] = [];

    try {
      imageUploads = await getFilesFromDto(dto.images, 'image');
      videoUploads = await getFilesFromDto(dto.videos, 'video');
      pdfUploads = await getFilesFromDto(dto.pdfs, 'pdf');
      uploads = [...imageUploads, ...videoUploads, ...pdfUploads];

      // Scrape web URL if provided
      let scrapedWebContent: ScrapedWebContent | null = null;
      if (dto.sourceUrl?.trim()) {
        console.log(`[GeminiProvider] Ingesting content from source URL: ${dto.sourceUrl.trim()}...`);
        scrapedWebContent = await scrapeWebContent(dto.sourceUrl.trim());
      }

      if (uploads && uploads.length > 0) {
        console.log(`[GeminiProvider] Uploading ${uploads.length} attached media file(s) to Gemini File API...`);
        const uploadPromises = uploads.map((element) => {
          return this.client.files.upload({
            file: element.path,
            config: { mimeType: element.mimetype },
          });
        });

        geminiUploads = await Promise.all(uploadPromises);

        // Wait for all files to become active (videos and large files can take time to process)
        const activeFilesPromises = geminiUploads.map(async (uploadedFile) => {
          let file = uploadedFile;
          const startTime = Date.now();
          const timeout = 180000; // 3 minutes timeout for processing
          const pollInterval = 4000;

          while (
            file.state === 'PROCESSING' &&
            Date.now() - startTime < timeout
          ) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            try {
              file = await this.client.files.get({ name: uploadedFile.name });
            } catch (e: any) {
              console.error(
                `Error getting file status for ${uploadedFile.name}:`,
                e?.message,
              );
              throw new Error(e.message);
            }
          }

          if (file.state !== 'ACTIVE') {
            console.error(
              `File ${file.name} did not become ACTIVE. Final state: ${file.state}`,
            );
            throw new Error(
              `File ${file.name} could not be processed. Its state is ${file.state}.`,
            );
          }

          return file;
        });

        const activeFiles = await Promise.all(activeFilesPromises);
        fileParts = activeFiles.map((file) =>
          createPartFromUri(file.uri, file.mimeType),
        );
      }

      const modelCandidates = Array.from(
        new Set([
          this.model,
          'gemini-3.5-flash-lite',
          'gemini-3.8-flash',
          'gemini-3-flash-preview',
        ]),
      );

      const promptString = generateQuizPrompt(dto, {
        uploadedImages: imageUploads.map((img, i) => ({ index: i, name: img.originalname })),
        uploadedVideos: videoUploads.map((vid, i) => ({ index: i, name: vid.originalname })),
        uploadedPdfs: pdfUploads.map((pdf, i) => ({ index: i, name: pdf.originalname })),
        scrapedUrlText: scrapedWebContent?.text,
      });

      const userContent = createUserContent([
        ...fileParts,
        promptString,
      ]);

      let responseText: string | null = null;
      let lastError: any = null;

      for (const candidateModel of modelCandidates) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(
              `[GeminiProvider] Attempting quiz generation with ${candidateModel} (attempt ${attempt})...`,
            );
            const response = await this.client.models.generateContent({
              model: candidateModel,
              contents: userContent,
              config: {
                responseMimeType: 'application/json',
                responseSchema: quizCreationSchema,
              },
            });

            if (response.text) {
              responseText = response.text;
              console.log(
                `[GeminiProvider] Successfully generated quiz using model: ${candidateModel}`,
              );
              break;
            }
          } catch (err: any) {
            lastError = err;
            const errMsg = err?.message || String(err);
            const isTransient =
              err?.status === 503 ||
              errMsg.includes('503') ||
              errMsg.includes('high demand') ||
              err?.status === 429 ||
              errMsg.includes('429');

            console.warn(
              `[GeminiProvider] Model ${candidateModel} failed on attempt ${attempt}:`,
              errMsg,
            );

            if (isTransient && attempt < 2) {
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 + Math.random() * 600),
              );
            } else {
              break;
            }
          }
        }

        if (responseText) {
          break;
        }
      }

      if (!responseText) {
        throw lastError || new Error('All model candidates failed to generate quiz.');
      }

      const parsed: IAiGeneratedQuizResponse = JSON.parse(responseText);

      // Ground and anchor references with verified public media URLs
      if (parsed?.quiz?.questions && Array.isArray(parsed.quiz.questions)) {
        for (let idx = 0; idx < parsed.quiz.questions.length; idx++) {
          const q = parsed.quiz.questions[idx];
          const ref = q.reference || ({} as any);

          if (ref.type === 'IMAGE' && imageUploads.length > 0) {
            const sIdx = Math.min(Math.max(0, ref.sourceIndex ?? 0), imageUploads.length - 1);
            ref.mediaUrl = imageUploads[sIdx].publicUrl;
            ref.sourceName = imageUploads[sIdx].originalname;
          } else if (ref.type === 'VIDEO_FRAME' && videoUploads.length > 0) {
            const sIdx = Math.min(Math.max(0, ref.sourceIndex ?? 0), videoUploads.length - 1);
            ref.mediaUrl = videoUploads[sIdx].publicUrl;
            ref.sourceName = videoUploads[sIdx].originalname;
          } else if (ref.type === 'PDF_PAGE' && pdfUploads.length > 0) {
            const sIdx = Math.min(Math.max(0, ref.sourceIndex ?? 0), pdfUploads.length - 1);
            ref.mediaUrl = pdfUploads[sIdx].publicUrl;
            ref.sourceName = pdfUploads[sIdx].originalname;
          } else if (ref.type === 'WEB_SOURCE' && scrapedWebContent?.imageUrls?.length) {
            ref.mediaUrl = scrapedWebContent.imageUrls[0];
            ref.sourceName = dto.sourceUrl || '';
          }

          // Fallback to verified Wikipedia / Wikimedia Commons CDN if no local mediaUrl was anchored
          if (!ref.mediaUrl) {
            ref.type = 'VERIFIED_CDN';
            const keyword = ref.searchKeyword || q.question;
            ref.mediaUrl = await resolveQuizRelatedImage(keyword, dto.prompt);
          }

          if (!ref.caption || ref.caption.trim().length === 0) {
            ref.caption = `Exhibit ${(idx + 1).toString().padStart(2, '0')} — Reference Exhibit`;
          }

          q.reference = ref;
        }
      }

      return parsed;
    } catch (error: any) {
      if (error instanceof ApiError) {
        console.error('API Error:', error.message);
        throw new Error(`API Error: ${error.message}`);
      } else {
        console.error('Unexpected Error:', error);
        throw new Error(`Unexpected Error: ${error.message}`);
      }
    } finally {
      // NOTE: We intentionally PRESERVE the local files in `uploads/quiz/` so that students
      // attempting the quiz can view their referenced images, video clips, and documents.
      // We safely delete remote temporary files from the Gemini File API to release remote quota:
      for (const gemFile of geminiUploads) {
        if (gemFile?.name) {
          await this.client.files.delete({ name: gemFile.name }).catch((err: any) => {
            console.warn(
              `[GeminiProvider] Remote file cleanup warning for ${gemFile.name}:`,
              err?.message,
            );
          });
        }
      }
    }
  }
}

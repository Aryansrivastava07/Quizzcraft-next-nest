import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { Quiz } from '../schemas/quiz.schema';
import { User } from '../schemas/user.schema';
import {
  answerQuizDto,
  attemptQuizDto,
  deployQuizDto,
  generateQuizDto,
} from './dto/quiz.request.dto';
import { ServiceResponse } from '../common/interfaces/service-response.interface';
import { generateQuizResponseData } from './dto/quiz.response.dto';
import { AI_PROVIDER } from '../ai/ai.constants';
import type { AiProvider } from '../ai/interfaces/ai-provider.interface';
import { IAiGeneratedQuizResponse } from '../common/interfaces/quiz.interface'; // Renamed interface
import { IQuiz } from '../common/interfaces/quiz-types.interface'; // New core interface
import { Attempts } from '../schemas/attempts.schema';
import { resolveQuizRelatedImage } from './utils/quiz-image.util';

@Injectable()
export class QuizService implements OnModuleInit {
  constructor(
    @Inject('USER_MODEL') private UserModel: Model<User>,
    @Inject('QUIZ_MODEL') private QuizModel: Model<Quiz>,
    @Inject('ATTEMPTS_MODEL') private AttemptsModel: Model<Attempts>,
    @Inject(AI_PROVIDER) private ai: AiProvider,
  ) {}

  async onModuleInit() {
    try {
      // 1. Ensure all quizzes with status DRAFT or without status are explicitly marked isDeployed: false
      await this.QuizModel.updateMany(
        { $or: [{ status: 'DRAFT' }, { status: { $exists: false } }, { status: null }] },
        { $set: { isDeployed: false, status: 'DRAFT' } },
      );
      // 2. Ensure quizzes with status LIVE, SCHEDULED, ANYTIME, ENDED are marked isDeployed: true
      await this.QuizModel.updateMany(
        { status: { $in: ['LIVE', 'SCHEDULED', 'ANYTIME', 'ENDED'] }, isDeployed: { $ne: true } },
        { $set: { isDeployed: true } },
      );
    } catch (e) {
      // Migration error ignore
    }
  }

  async generateUniquePin(): Promise<string> {
    let pin = '';
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 25) {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
      const found = await this.QuizModel.findOne({ pin }).lean();
      if (!found) {
        exists = false;
      }
      attempts++;
    }
    if (exists) {
      pin = String(Date.now()).slice(-6);
    }
    return pin;
  }

  async generateQuiz(
    dto: generateQuizDto,
    owner?: { ownerId?: string; ownerEmail?: string },
  ): Promise<ServiceResponse<generateQuizResponseData>> {
    try {
      const fileNames: string[] = [
        ...(dto.pdfs?.map((f) => f.originalname) || []),
        ...(dto.images?.map((f) => f.originalname) || []),
        ...(dto.videos?.map((f) => f.originalname) || []),
      ];

      if (!dto.prompt || !dto.prompt.trim()) {
        if (fileNames.length > 0) {
          dto.prompt = `Generate a high-yield, comprehensive educational quiz covering the key concepts, formulas, and facts presented in the attached materials: ${fileNames.join(', ')}.`;
        } else if (dto.sourceUrl?.trim()) {
          dto.prompt = `Generate a high-yield, comprehensive educational quiz covering the key concepts from the source URL: ${dto.sourceUrl.trim()}`;
        } else {
          throw new BadRequestException(
            'Please provide a topic prompt, attach media files (PDF, Image, or Video), or specify a web URL.',
          );
        }
      }

      const generatedQuiz: IAiGeneratedQuizResponse =
        await this.ai.generateQuiz(dto);
      try {
        // Resolve a topic-related image (Wikipedia / verified CDN preset; zero AI URL hallucinations)
        const coverImage = await resolveQuizRelatedImage(
          generatedQuiz.quiz.title,
          dto.prompt,
        );

        const questions = generatedQuiz.quiz.questions.map((question, idx) => {
          const rawLevel = String((question as any).level || (idx % 3 === 0 ? 'EASY' : idx % 3 === 1 ? 'MEDIUM' : 'HARD')).toUpperCase();
          const level = rawLevel === 'EASY' ? 'EASY' : rawLevel === 'HARD' ? 'HARD' : 'MEDIUM';
          const xp = Number((question as any).xp) || (level === 'EASY' ? 100 : level === 'HARD' ? 300 : 200);
          return {
            ...question,
            questionId: randomUUID(),
            answer: String(question.answer),
            level,
            xp,
            explanation: question.explanation || '',
            reference: question.reference || {
              type: 'VERIFIED_CDN',
              caption: `Exhibit ${(idx + 1).toString().padStart(2, '0')}`,
              mediaUrl: coverImage,
            },
          };
        });

        const pin = await this.generateUniquePin();

        const newQuiz: IQuiz = {
          quizId: randomUUID(),
          pin,
          title: generatedQuiz.quiz.title,
          coverImage,
          ownerId: owner?.ownerId,
          ownerEmail: owner?.ownerEmail,
          isDeployed: false,
          status: 'DRAFT',
          immediateResult: true,
          questime: 60,
          dynamicShuffle: true,
          temporalLimit: true,
          questions,
        };
        const createdQuiz = await this.QuizModel.create(newQuiz);
        return {
          message: 'Quiz generated successfully',
          data: {
            quiz: createdQuiz.toObject() as Quiz & IQuiz,
          },
        };
      } catch (error) {
        console.error('Error while creating new quiz object:', error);
        throw new Error('Failed to create new quiz object');
      }
    } catch (error: any) {
      throw new Error(`Failed to generate quiz: ${error}`);
    }
  }

  async getQuizByPin(
    pin: string,
    userEmail?: string,
  ): Promise<ServiceResponse<any>> {
    const cleanPin = pin.replace(/\D/g, '');
    const quiz = await this.QuizModel.findOne({
      $or: [{ pin: cleanPin }, { pin }],
    });

    if (!quiz) {
      throw new NotFoundException(`No active quiz found matching PIN: ${pin}`);
    }

    const now = new Date();

    // 1. Check Organization Access Control
    if (quiz.accessMode === 'ORGANIZATION') {
      const requiredDomain = (quiz.organizationDomain || '').toLowerCase().trim();
      const normalizedUserEmail = (userEmail || '').toLowerCase().trim();

      if (!normalizedUserEmail) {
        return {
          message: 'Organization domain restricted',
          data: {
            isRestricted: true,
            organizationDomain: requiredDomain,
            message: `This quiz is restricted to members of @${requiredDomain}. Please log in with your organization email to join.`,
          },
        };
      }

      // Check if user has an email matching required organization domain
      const user = await this.UserModel.findOne({
        $or: [{ email: normalizedUserEmail }, { emails: normalizedUserEmail }],
      }).lean();

      const allUserEmails = user
        ? Array.isArray(user.emails) && user.emails.length > 0
          ? user.emails
          : [user.email]
        : [normalizedUserEmail];

      const hasMatchingDomain = allUserEmails.some(
        (e) => e.split('@')[1]?.toLowerCase().trim() === requiredDomain,
      );

      if (!hasMatchingDomain) {
        return {
          message: 'Organization domain unauthorized',
          data: {
            isRestricted: true,
            organizationDomain: requiredDomain,
            userEmail: normalizedUserEmail,
            message: `Access denied. This quiz is restricted to verified accounts from @${requiredDomain}. Your active email (${normalizedUserEmail}) is not authorized.`,
          },
        };
      }
    }

    // 1b. Check Organization Membership Control
    if (quiz.orgId) {
      const normalizedUserEmail = (userEmail || '').toLowerCase().trim();
      if (!normalizedUserEmail) {
        return {
          message: 'Organization membership required',
          data: {
            isRestricted: true,
            message: 'This quiz is exclusive to organization members. Please log in to join.',
          },
        };
      }
      const user = await this.UserModel.findOne({
        $or: [{ email: normalizedUserEmail }, { emails: normalizedUserEmail }],
      }).lean();
      if (!user || (user.orgId !== quiz.orgId && user.role !== 'SUPER_ADMIN')) {
        return {
          message: 'Organization membership unauthorized',
          data: {
            isRestricted: true,
            message: 'Access denied. You must be an enrolled member of this organization to access this quiz.',
          },
        };
      }
    }

    if (!quiz.coverImage || quiz.coverImage.includes('photo-1518770660439-4636190af475')) {
      const resolved = await resolveQuizRelatedImage(quiz.title);
      quiz.coverImage = resolved;
      await quiz.save().catch(() => {});
    }

    // 2. Check if Scheduled (not yet live)
    if (quiz.status === 'SCHEDULED' && quiz.scheduledFor && now < new Date(quiz.scheduledFor)) {
      return {
        message: 'Quiz is scheduled',
        data: {
          isScheduled: true,
          quizId: quiz.quizId,
          title: quiz.title,
          coverImage: quiz.coverImage || '',
          pin: quiz.pin,
          scheduledFor: quiz.scheduledFor,
          waitingCadetsCount: quiz.waitingList?.length || 0,
          questionCount: quiz.questions?.length || 0,
          totalXp: (quiz.questions || []).reduce((sum, q) => sum + (q.xp || 200), 0),
          isWaiting: Boolean(userEmail && quiz.waitingList?.includes(userEmail.toLowerCase().trim())),
        },
      };
    }

    // 3. Check if Ended or Live window expired
    if (quiz.status === 'ENDED' || (quiz.liveUntil && now > new Date(quiz.liveUntil))) {
      return {
        message: 'Quiz arena session concluded',
        data: {
          isEnded: true,
          quizId: quiz.quizId,
          title: quiz.title,
          message: 'This quiz arena session has concluded and is no longer accepting answers.',
        },
      };
    }

    const attempts = await this.AttemptsModel.find({ quizId: quiz.quizId }).lean();
    const peopleAttempted = attempts.length;
    let totalPct = 0;
    let counted = 0;
    const totalQuestions = quiz.questions?.length || 1;
    for (const a of attempts) {
      if (typeof a.score === 'number') {
        const pct = Math.round((a.score / totalQuestions) * 100);
        totalPct += pct;
        counted++;
      }
    }
    const averageScore = counted > 0 ? Math.round(totalPct / counted) : 0;

    return {
      message: 'Quiz fetched successfully',
      data: {
        quiz: quiz.toObject() as Quiz & IQuiz,
        stats: {
          peopleAttempted,
          averageScore,
        },
      },
    };
  }

  async getQuiz(quizId: string): Promise<ServiceResponse<{ quiz: Quiz & IQuiz; stats?: { peopleAttempted: number; averageScore: number } }>> {
    const cleanId = quizId ? quizId.trim() : '';
    const cleanPin = cleanId.replace(/\D/g, '');
    let quiz = await this.QuizModel.findOne({ quizId: cleanId });
    if (!quiz && cleanPin && cleanPin.length === 6) {
      quiz = await this.QuizModel.findOne({ pin: cleanPin });
    }
    if (!quiz && cleanId.length === 24 && /^[0-9a-fA-F]{24}$/.test(cleanId)) {
      quiz = await this.QuizModel.findById(cleanId);
    }
    if (!quiz) {
      throw new NotFoundException('No Quiz found for this Id');
    }

    if (!quiz.coverImage || quiz.coverImage.includes('photo-1518770660439-4636190af475')) {
      const resolved = await resolveQuizRelatedImage(quiz.title);
      quiz.coverImage = resolved;
      await quiz.save().catch(() => {});
    }

    const attempts = await this.AttemptsModel.find({ quizId: quiz.quizId }).lean();
    const peopleAttempted = attempts.length;
    let totalPct = 0;
    let counted = 0;
    const totalQuestions = quiz.questions?.length || 1;
    for (const a of attempts) {
      if (typeof a.score === 'number') {
        const pct = Math.round((a.score / totalQuestions) * 100);
        totalPct += pct;
        counted++;
      }
    }
    const averageScore = counted > 0 ? Math.round(totalPct / counted) : 0;

    return {
      message: 'Quiz fetched successfully',
      data: {
        quiz: quiz.toObject() as Quiz & IQuiz,
        stats: {
          peopleAttempted,
          averageScore,
        },
      },
    };
  }

  async updateQuiz(
    quizId: string,
    updateData: {
      title?: string;
      coverImage?: string;
      accessMode?: 'PUBLIC' | 'PRIVATE' | 'ORGANIZATION';
      organizationDomain?: string;
      antiCheat?: boolean;
      fullScreenLock?: boolean;
      shuffleChoices?: boolean;
      allowRetries?: boolean;
      deploymentType?: 'LIVE' | 'SCHEDULED' | 'ANYTIME';
      isDeployed?: boolean;
      status?: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ANYTIME' | 'ENDED';
      questions?: any[];
      immediateResult?: boolean;
      questime?: number;
      dynamicShuffle?: boolean;
      temporalLimit?: boolean;
    },
  ): Promise<ServiceResponse<{ updated: boolean }>> {
    const cleanId = quizId ? quizId.trim() : '';
    const cleanPin = cleanId.replace(/\D/g, '');
    let quiz = await this.QuizModel.findOne({ quizId: cleanId });
    if (!quiz && cleanPin && cleanPin.length === 6) {
      quiz = await this.QuizModel.findOne({ pin: cleanPin });
    }
    if (!quiz && cleanId.length === 24 && /^[0-9a-fA-F]{24}$/.test(cleanId)) {
      quiz = await this.QuizModel.findById(cleanId);
    }
    if (!quiz) {
      throw new NotFoundException('No Quiz found for this Id');
    }

    const setPayload: any = {};
    if (updateData.title !== undefined) {
      setPayload.title = updateData.title;
    }
    if (updateData.coverImage !== undefined) {
      setPayload.coverImage = updateData.coverImage;
    }
    if (updateData.accessMode !== undefined) {
      setPayload.accessMode = updateData.accessMode;
      if (updateData.accessMode === 'PUBLIC') {
        setPayload.isPractice = false;
      }
    }
    if (updateData.organizationDomain !== undefined) {
      setPayload.organizationDomain = updateData.organizationDomain;
    }
    if (updateData.antiCheat !== undefined) {
      setPayload.antiCheat = Boolean(updateData.antiCheat);
    }
    if (updateData.fullScreenLock !== undefined) {
      setPayload.fullScreenLock = Boolean(updateData.fullScreenLock);
    }
    if (updateData.shuffleChoices !== undefined) {
      setPayload.shuffleChoices = Boolean(updateData.shuffleChoices);
    }
    if (updateData.allowRetries !== undefined) {
      setPayload.allowRetries = Boolean(updateData.allowRetries);
    }
    if (updateData.deploymentType !== undefined) {
      setPayload.deploymentType = updateData.deploymentType;
    }
    if (updateData.isDeployed !== undefined) {
      setPayload.isDeployed = Boolean(updateData.isDeployed);
    }
    if (updateData.status !== undefined) {
      setPayload.status = updateData.status;
    }
    if (updateData.immediateResult !== undefined) {
      setPayload.immediateResult = updateData.immediateResult;
    }
    if (updateData.questime !== undefined) {
      setPayload.questime = Math.max(30, Math.min(300, Number(updateData.questime)));
    }
    if (updateData.dynamicShuffle !== undefined) {
      setPayload.dynamicShuffle = Boolean(updateData.dynamicShuffle);
    }
    if (updateData.temporalLimit !== undefined) {
      setPayload.temporalLimit = Boolean(updateData.temporalLimit);
    }
    if (Array.isArray(updateData.questions)) {
      setPayload.questions = updateData.questions.map((q) => {
        const level = (q.level || q.difficulty || 'MEDIUM').toUpperCase();
        const xp = level === 'EASY' ? 100 : level === 'HARD' ? 300 : 200;
        return {
          questionId: q.questionId || q.id || randomUUID(),
          question: q.question,
          options: Array.isArray(q.options)
            ? q.options.map((opt: any) => (typeof opt === 'string' ? opt : opt.text))
            : [],
          answer: q.answer !== undefined
            ? String(q.answer)
            : String(q.options?.find?.((opt: any) => opt.correct)?.text || ''),
          explanation: q.explanation || '',
          level,
          xp,
        };
      });
    }

    const result = await this.QuizModel.updateOne(
      { _id: quiz._id },
      { $set: setPayload },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('No Quiz found for this Id');
    }
    return {
      message: 'Quiz updated successfully',
      data: { updated: true },
    };
  }

  async editQuestion(
    quizId: string,
    questionId: string,
    dto: {
      question?: string;
      options?: string[];
      answer?: string;
      explanation?: string;
      level?: string;
    },
  ) {
    const quiz = await this.QuizModel.findOne({ quizId });
    if (!quiz) throw new NotFoundException('No Quiz found for this Id');

    const qIndex = quiz.questions.findIndex((q) => q.questionId === questionId);
    if (qIndex === -1) {
      throw new NotFoundException('Question not found in this quiz');
    }

    const currentQ = quiz.questions[qIndex];
    const qObj = (currentQ as any).toObject ? (currentQ as any).toObject() : currentQ;
    const rawLevel = (dto.level || qObj.level || 'MEDIUM').toUpperCase();
    const level = rawLevel === 'EASY' ? 'EASY' : rawLevel === 'HARD' ? 'HARD' : 'MEDIUM';
    const xp = level === 'EASY' ? 100 : level === 'HARD' ? 300 : 200;

    let updatedOptions = qObj.options;
    if (Array.isArray(dto.options)) {
      updatedOptions = dto.options.map((opt: any) =>
        typeof opt === 'string' ? opt : opt.text,
      );
    }

    const updatedQ = {
      questionId,
      question: dto.question !== undefined ? dto.question : qObj.question,
      options: updatedOptions,
      answer: dto.answer !== undefined ? String(dto.answer) : qObj.answer,
      explanation: dto.explanation !== undefined ? dto.explanation : (qObj.explanation || ''),
      level,
      xp,
    };

    quiz.questions[qIndex] = updatedQ;

    await this.QuizModel.updateOne(
      { quizId },
      { $set: { questions: quiz.questions } },
    );

    return {
      message: 'Question updated successfully',
      data: { question: updatedQ, updated: true },
    };
  }

  async addQuestion(
    quizId: string,
    dto: {
      question: string;
      options: string[];
      answer: string;
      explanation?: string;
      level?: string;
    },
  ) {
    const quiz = await this.QuizModel.findOne({ quizId });
    if (!quiz) throw new NotFoundException('No Quiz found for this Id');

    const rawLevel = (dto.level || 'MEDIUM').toUpperCase();
    const level = rawLevel === 'EASY' ? 'EASY' : rawLevel === 'HARD' ? 'HARD' : 'MEDIUM';
    const xp = level === 'EASY' ? 100 : level === 'HARD' ? 300 : 200;

    const newQuestion = {
      questionId: randomUUID(),
      question: dto.question || 'New Question statement',
      options: Array.isArray(dto.options)
        ? dto.options.map((o: any) => (typeof o === 'string' ? o : o.text))
        : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      answer: String(dto.answer || '0'),
      explanation: dto.explanation || '',
      level,
      xp,
    };

    await this.QuizModel.updateOne(
      { quizId },
      { $push: { questions: newQuestion } },
    );

    return {
      message: 'Question added successfully',
      data: { question: newQuestion, created: true },
    };
  }

  async deleteQuestion(quizId: string, questionId: string) {
    const quiz = await this.QuizModel.findOne({ quizId });
    if (!quiz) throw new NotFoundException('No Quiz found for this Id');

    await this.QuizModel.updateOne(
      { quizId },
      { $pull: { questions: { questionId } } },
    );

    return {
      message: 'Question deleted successfully',
      data: { deleted: true },
    };
  }

  async createAttempt(dto: attemptQuizDto, userId: string) {
    const quiz = await this.QuizModel.findOne({ quizId: dto.quizId });
    if (!quiz) throw new NotFoundException('No Quiz found for this Id');
    const lastSession = await this.AttemptsModel.findOne({
      userId,
      isActive: true,
    });

    const timeBufferAllowed = 5 * 60 * 1000;

    if (lastSession) {
      const lastUpdatedAt = new Date(lastSession.lastUpdateAt).getTime();
      const now = Date.now();
      const isExpired = now - lastUpdatedAt >= timeBufferAllowed;

      if (!isExpired) {
        return {
          message: 'An active session already exists',
          data: { session: lastSession },
        };
      }

      await this.AttemptsModel.updateOne(
        { sessionId: lastSession.sessionId },
        { isActive: false },
      );
    }

    const sessionId = randomUUID();
    const createSession = await this.AttemptsModel.create({
      sessionId,
      quizId: dto.quizId,
      userId,
      isActive: true,
      lastUpdateAt: new Date().toISOString(),
      Responses: [],
    });

    return {
      message: 'dwdw',
      data: {
        createSession,
      },
    };
  }

  async updateResponse(sessionId: string, dto: answerQuizDto, userId: string) {
    const session = await this.AttemptsModel.findOne({ sessionId });

    if (!session || !session.isActive) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new UnauthorizedException('User not Authorized');
    }

    const existingIndex = session.Responses.findIndex(
      (response) => response.questionId === dto.questionId,
    );

    const updatedResponses = [...session.Responses];
    const newResponse = {
      questionId: dto.questionId,
      chosenOption: [dto.option],
    };

    if (existingIndex >= 0) {
      updatedResponses[existingIndex] = newResponse;
    } else {
      updatedResponses.push(newResponse);
    }

    const result = await this.AttemptsModel.updateOne(
      { sessionId },
      {
        Responses: updatedResponses,
        lastUpdateAt: new Date().toISOString(),
      },
    );

    return {
      message: 'Answer Saved',
      data: true,
    };
  }

  async submitResponse(sessionId: string, dto: answerQuizDto, userId: string) {
    const session = await this.AttemptsModel.findOne({ sessionId });
    const user = await this.UserModel.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (!session || !session.isActive) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new UnauthorizedException('User not Authorized');
    }

    const existingIndex = session.Responses.findIndex(
      (response) => response.questionId === dto.questionId,
    );

    const updatedResponses = [...session.Responses];
    const newResponse = {
      questionId: dto.questionId,
      chosenOption: [dto.option],
    };

    if (existingIndex >= 0) {
      updatedResponses[existingIndex] = newResponse;
    } else {
      updatedResponses.push(newResponse);
    }

    await this.AttemptsModel.updateOne(
      { sessionId },
      {
        Responses: updatedResponses,
        lastUpdateAt: new Date().toISOString(),
        isActive: false,
      },
    );

    const userAttempt = await this.AttemptsModel.find({
      userId,
    });
    if (userAttempt.length === 1 && userAttempt[0].sessionId === sessionId) {
      const quizAttempted = (user.quizAttempted || 0) + 1;
      await this.UserModel.updateOne({ _id: userId }, { quizAttempted });
    }

    return {
      message: 'Quiz Submitted',
      data: true,
    };
  }

  async getScore(sessionId: string, userId: string) {
    const user = await this.UserModel.findById(userId);
    const session = await this.AttemptsModel.findOne({ sessionId });
    if (!user || session?.userId != userId) throw new UnauthorizedException();
    if (!session || session.isActive) {
      throw new InternalServerErrorException('Session is still active');
    }
    const quiz = await this.QuizModel.findOne({ quizId: session.quizId });
    let score = 0;
    session.Responses.forEach((response) => {
      const questionId = response.questionId;
      const correctOption = quiz?.questions.find((question) => question.questionId === questionId)?.answer;
      score += Number(correctOption === response.chosenOption[0]);
    });
    await this.AttemptsModel.updateOne({ sessionId }, { score });
    const userAttemptsCount = Math.max(1, user.quizAttempted || 1);
    const newAverageScore = ((user.averageScore || 0) * (userAttemptsCount - 1) + score) / userAttemptsCount;
    await this.UserModel.updateOne({ _id: userId }, { averageScore: newAverageScore });
    return {
      message: 'Score fetched',
      data: score,
    };
  }

  async deployQuiz(
    quizId: string,
    userId: string,
    dto: deployQuizDto,
  ): Promise<ServiceResponse<any>> {
    const quiz = await this.QuizModel.findOne({ quizId });
    if (!quiz) throw new NotFoundException('Quiz not found');

    const user = await this.UserModel.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const accessMode = dto.accessMode || 'PUBLIC';
    let organizationDomain = dto.organizationDomain ? dto.organizationDomain.toLowerCase().trim() : null;

    if (accessMode === 'ORGANIZATION') {
      const allUserEmails = Array.isArray(user.emails) && user.emails.length > 0 ? user.emails : [user.email];
      const publicDomains = [
        'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
        'protonmail.com', 'aol.com', 'zoho.com', 'mail.com', 'yandex.com', 'gmx.com'
      ];
      const orgEmails = allUserEmails.filter((e) => {
        const dom = e.split('@')[1]?.toLowerCase().trim();
        return dom && !publicDomains.includes(dom);
      });

      if (orgEmails.length === 0) {
        throw new BadRequestException(
          'To create an organization-accessible quiz, you must have a verified organization email linked to your account (e.g. university or company domain).',
        );
      }

      if (!organizationDomain) {
        organizationDomain = orgEmails[0].split('@')[1].toLowerCase().trim();
      } else {
        const matchesUserEmail = orgEmails.some(
          (e) => e.split('@')[1]?.toLowerCase().trim() === organizationDomain,
        );
        if (!matchesUserEmail) {
          throw new BadRequestException(
            `You do not have a linked email matching domain @${organizationDomain}. Please link an email from this organization first.`,
          );
        }
      }
    }

    const deploymentType = dto.deploymentType || 'LIVE';
    const now = new Date();
    let status: 'LIVE' | 'SCHEDULED' | 'ANYTIME' = 'LIVE';
    let scheduledFor: Date | null = null;
    let liveUntil: Date | null = null;
    const durationMinutes = Math.max(15, Math.min(1440, Number(dto.liveDurationMinutes) || 60));

    if (deploymentType === 'LIVE') {
      status = 'LIVE';
      liveUntil = new Date(now.getTime() + durationMinutes * 60 * 1000);
    } else if (deploymentType === 'SCHEDULED') {
      status = 'SCHEDULED';
      if (!dto.scheduledFor) {
        throw new BadRequestException('A scheduled date and time is required for scheduled deployment');
      }
      scheduledFor = new Date(dto.scheduledFor);
      if (isNaN(scheduledFor.getTime())) {
        throw new BadRequestException('Invalid scheduled date format');
      }
      liveUntil = new Date(scheduledFor.getTime() + durationMinutes * 60 * 1000);
    } else if (deploymentType === 'ANYTIME') {
      status = 'ANYTIME';
      liveUntil = null;
    }

    const isOrgUser = user.role === 'ORG_STD' || (user.role as string) === 'ORG_USER';
    const isPracticeFinal = isOrgUser ? true : (dto.isPractice ?? false);
    const accessModeFinal = isOrgUser ? 'PRIVATE' : accessMode;
    const orgIdFinal = user.orgId || null;
    const groupIdFinal = (!isOrgUser && dto.groupId) ? dto.groupId : null;
    const dueDateFinal = (!isOrgUser && dto.dueDate) ? new Date(dto.dueDate) : null;

    const updated = await this.QuizModel.findOneAndUpdate(
      { quizId },
      {
        $set: {
          isDeployed: true,
          ownerId: userId,
          ownerEmail: user.email,
          deploymentType,
          accessMode: accessModeFinal,
          organizationDomain,
          status,
          scheduledFor,
          liveDurationMinutes: durationMinutes,
          liveUntil,
          scheduledAlertSent: false,
          antiCheat: dto.antiCheat ?? true,
          fullScreenLock: dto.fullScreenLock ?? true,
          shuffleChoices: dto.shuffleChoices ?? true,
          allowRetries: dto.allowRetries ?? false,
          isPractice: isPracticeFinal,
          orgId: orgIdFinal,
          groupId: groupIdFinal,
          dueDate: dueDateFinal,
        },
      },
      { new: true },
    );

    return {
      message: `Quiz deployed successfully with protocol: ${deploymentType}`,
      data: {
        quiz: updated,
        deploymentType,
        status,
        accessMode,
        adminUrl: `/quiz/admin?quizId=${encodeURIComponent(quizId)}`,
        joinUrl: `/join`,
        pin: quiz.pin,
      },
    };
  }

  async getQuizAdminData(
    quizId: string,
    userId: string,
  ): Promise<ServiceResponse<any>> {
    let quiz = await this.QuizModel.findOne({ quizId });
    if (!quiz && quizId.length === 6 && /^\d+$/.test(quizId)) {
      quiz = await this.QuizModel.findOne({ pin: quizId });
    }
    if (!quiz) throw new NotFoundException('Quiz not found');

    const isOwner = Boolean(quiz.ownerId && String(quiz.ownerId) === String(userId));

    // Fetch all attempts for this quiz
    const attempts = await this.AttemptsModel.find({ quizId: quiz.quizId }).lean();
    const totalAttendees = attempts.length;
    const activeAttendees = attempts.filter((a) => a.isActive).length;

    // Leaderboard calculation
    const userIds = attempts.map((a) => a.userId).filter(Boolean);
    const users = await this.UserModel.find({ _id: { $in: userIds } })
      .select('username fullName profilePicture email xp')
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const totalQuestions = quiz.questions?.length || 1;
    let totalScoreSum = 0;
    let completedCount = 0;

    const leaderboard = attempts
      .map((attempt) => {
        const cadet = userMap.get(String(attempt.userId));
        const score = typeof attempt.score === 'number' ? attempt.score : 0;
        const percentage = Math.round((score / totalQuestions) * 100);

        if (!attempt.isActive) {
          totalScoreSum += percentage;
          completedCount++;
        }

        return {
          sessionId: attempt.sessionId,
          userId: attempt.userId,
          username: cadet?.username || 'Cadet Pilot',
          fullName: cadet?.fullName || cadet?.username || 'Anonymous Cadet',
          avatar: cadet?.profilePicture || '',
          score,
          totalQuestions,
          percentage,
          isActive: attempt.isActive,
          lastUpdateAt: attempt.lastUpdateAt,
        };
      })
      .sort((a, b) => b.score - a.score || b.percentage - a.percentage);

    const averageScore = completedCount > 0 ? Math.round(totalScoreSum / completedCount) : 0;

    if (!quiz.coverImage || quiz.coverImage.includes('photo-1518770660439-4636190af475')) {
      quiz.coverImage = await resolveQuizRelatedImage(quiz.title);
      await quiz.save().catch(() => {});
    }

    return {
      message: 'Admin telemetry loaded successfully',
      data: {
        quiz: quiz.toObject(),
        attendeesCount: totalAttendees,
        activeAttendeesCount: activeAttendees,
        averageScore,
        waitingCadetsCount: quiz.waitingList?.length || 0,
        waitingList: quiz.waitingList || [],
        leaderboard,
        isOwner,
      },
    };
  }

  async joinWaitlist(
    quizId: string,
    userEmail: string,
  ): Promise<ServiceResponse<any>> {
    const quiz = await this.QuizModel.findOne({
      $or: [{ quizId }, { pin: quizId }],
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    const cleanEmail = (userEmail || '').toLowerCase().trim();
    if (!cleanEmail) {
      throw new BadRequestException('A valid email is required to join waitlist');
    }

    const currentList = quiz.waitingList || [];
    if (!currentList.includes(cleanEmail)) {
      currentList.push(cleanEmail);
      await this.QuizModel.updateOne(
        { quizId: quiz.quizId },
        { $set: { waitingList: currentList } },
      );
    }

    return {
      message: 'Joined waitlist successfully',
      data: {
        quizId: quiz.quizId,
        waitingCadetsCount: currentList.length,
        joined: true,
      },
    };
  }

  async closeQuiz(
    quizId: string,
    userId: string,
  ): Promise<ServiceResponse<any>> {
    const quiz = await this.QuizModel.findOne({ quizId });
    if (!quiz) throw new NotFoundException('Quiz not found');

    if (quiz.ownerId && String(quiz.ownerId) !== String(userId)) {
      throw new UnauthorizedException('Only the quiz owner can conclude the session');
    }

    await this.QuizModel.updateOne(
      { quizId },
      { $set: { status: 'ENDED', liveUntil: new Date() } },
    );

    return {
      message: 'Quiz session concluded',
      data: {
        quizId,
        status: 'ENDED',
        closed: true,
      },
    };
  }

  /**
   * Fetch all deployed public quizzes for community discovery.
   * STRICT FILTER: accessMode === 'PUBLIC' and status !== 'DRAFT'.
   * Never returns questions or answers.
   */
  async getPublicQuizzes(query: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ServiceResponse<{
    quizzes: Array<{
      quizId: string;
      title: string;
      pin?: string;
      deploymentType?: string;
      status?: string;
      scheduledFor?: Date;
      liveDurationMinutes?: number;
      liveUntil?: Date;
      questionsCount: number;
      attemptsCount: number;
      questime?: number;
      createdAt?: Date;
      creator: {
        username: string;
        fullName: string;
        avatar: string;
      };
    }>;
    total: number;
    page: number;
    limit: number;
  }>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 24));
    const skip = (page - 1) * limit;

    const filter: any = {
      accessMode: 'PUBLIC',
      status: { $in: ['LIVE', 'SCHEDULED', 'ANYTIME', 'ENDED'] },
    };

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { pin: q },
      ];
    }

    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    }

    const [total, rawQuizzes] = await Promise.all([
      this.QuizModel.countDocuments(filter),
      this.QuizModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // Gather creator user details and attempts count in bulk
    const ownerIds = rawQuizzes.map((q) => q.ownerId).filter(Boolean);
    const quizIds = rawQuizzes.map((q) => q.quizId);

    const [users, attemptCounts] = await Promise.all([
      this.UserModel.find({ _id: { $in: ownerIds } })
        .select('username fullName profilePicture')
        .lean(),
      this.AttemptsModel.aggregate([
        { $match: { quizId: { $in: quizIds } } },
        { $group: { _id: '$quizId', count: { $sum: 1 } } },
      ]),
    ]);

    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const countMap = new Map(attemptCounts.map((c) => [c._id, c.count]));

    const quizzes = rawQuizzes.map((q: any) => {
      const creator = q.ownerId ? userMap.get(String(q.ownerId)) : null;
      return {
        quizId: q.quizId,
        title: q.title,
        coverImage: q.coverImage || '',
        pin: q.pin,
        isDeployed: Boolean(q.isDeployed),
        deploymentType: q.deploymentType,
        status: q.status,
        scheduledFor: q.scheduledFor,
        liveDurationMinutes: q.liveDurationMinutes,
        liveUntil: q.liveUntil,
        questionsCount: Array.isArray(q.questions) ? q.questions.length : 0,
        attemptsCount: countMap.get(q.quizId) || 0,
        questime: q.questime || 60,
        createdAt: q.createdAt,
        creator: {
          username: creator?.username || 'QuizzCraft Creator',
          fullName: creator?.fullName || creator?.username || 'Creator',
          avatar: creator?.profilePicture || '',
        },
      };
    });

    return {
      message: 'Public deployed quizzes fetched successfully',
      data: {
        quizzes,
        total,
        page,
        limit,
      },
    };
  }

  /**
   * Fetch quiz review, statistics, and leaderboard.
   * Access:
   * - Public quizzes: Accessible to everyone.
   * - Non-public quizzes: Accessible ONLY to quiz creator (ownerId === currentUserId).
   * STRICT CONSTRAINT: No questions or answer keys are returned in the payload.
   */
  async getQuizReview(
    quizId: string,
    currentUserId?: string,
  ): Promise<ServiceResponse<{
    quiz: {
      quizId: string;
      title: string;
      coverImage?: string;
      pin?: string;
      isDeployed?: boolean;
      status?: string;
      deploymentType?: string;
      accessMode?: string;
      scheduledFor?: Date;
      liveDurationMinutes?: number;
      liveUntil?: Date;
      totalQuestions: number;
      questime?: number;
      createdAt?: Date;
      antiCheat?: boolean;
    };
    owner: {
      username: string;
      fullName: string;
      avatar: string;
      isCurrentUser: boolean;
    };
    stats: {
      totalAttempts: number;
      completedAttempts: number;
      activeAttempts: number;
      averageScore: number;
      highestScore: number;
      lowestScore: number;
      passRate: number;
    };
    leaderboard: Array<{
      sessionId: string;
      userId: string;
      username: string;
      fullName: string;
      avatar: string;
      score: number;
      totalQuestions: number;
      percentage: number;
      isActive: boolean;
      lastUpdateAt: string;
    }>;
    isOwner: boolean;
    isPublic: boolean;
    canAttempt: boolean;
  }>> {
    let quiz = await this.QuizModel.findOne({ quizId });
    if (!quiz && quizId.length === 6 && /^\d+$/.test(quizId)) {
      quiz = await this.QuizModel.findOne({ pin: quizId });
    }
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    const isOwner = Boolean(
      currentUserId && quiz.ownerId && String(quiz.ownerId) === String(currentUserId),
    );
    const isPublic = quiz.accessMode === 'PUBLIC';

    // Access control: Only quiz creator or public if quiz is public
    if (!isPublic && !isOwner) {
      throw new ForbiddenException(
        'This quiz review is private. Only the quiz creator has permission to view this review.',
      );
    }

    // Fetch all attempts for this quiz
    const attempts = await this.AttemptsModel.find({ quizId: quiz.quizId }).lean();
    const totalAttempts = attempts.length;
    const activeAttempts = attempts.filter((a) => a.isActive).length;

    // Fetch user details for attempts
    const userIds = attempts.map((a) => a.userId).filter(Boolean);
    const [users, creator] = await Promise.all([
      this.UserModel.find({ _id: { $in: userIds } })
        .select('username fullName profilePicture email xp')
        .lean(),
      quiz.ownerId
        ? this.UserModel.findById(quiz.ownerId)
            .select('username fullName profilePicture')
            .lean()
        : null,
    ]);

    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const totalQuestions = quiz.questions?.length || 0;
    let completedCount = 0;
    let totalScoreSum = 0;
    const numericScores: number[] = [];

    const leaderboard = attempts
      .map((attempt) => {
        const cadet = userMap.get(String(attempt.userId));
        const score = typeof attempt.score === 'number' ? attempt.score : 0;
        const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

        if (!attempt.isActive && typeof attempt.score === 'number') {
          totalScoreSum += percentage;
          completedCount++;
          numericScores.push(score);
        }

        return {
          sessionId: attempt.sessionId,
          userId: attempt.userId,
          username: cadet?.username || 'Cadet Pilot',
          fullName: cadet?.fullName || cadet?.username || 'Cadet Pilot',
          avatar: cadet?.profilePicture || '',
          score,
          totalQuestions,
          percentage,
          isActive: attempt.isActive,
          lastUpdateAt: attempt.lastUpdateAt,
        };
      })
      .sort((a, b) => b.score - a.score || b.percentage - a.percentage);

    const averageScore = completedCount > 0 ? Math.round(totalScoreSum / completedCount) : 0;
    const highestScore = numericScores.length > 0 ? Math.max(...numericScores) : 0;
    const lowestScore = numericScores.length > 0 ? Math.min(...numericScores) : 0;
    const passThreshold = totalQuestions * 0.5;
    const passedCount = numericScores.filter((s) => s >= passThreshold).length;
    const passRate = completedCount > 0 ? Math.round((passedCount / completedCount) * 100) : 0;

    const canAttempt =
      quiz.status === 'LIVE' ||
      quiz.status === 'ANYTIME' ||
      (quiz.status === 'SCHEDULED' && quiz.scheduledFor && new Date() >= new Date(quiz.scheduledFor));

    let coverImage = quiz.coverImage;
    if (!coverImage || coverImage.includes('photo-1518770660439-4636190af475')) {
      coverImage = await resolveQuizRelatedImage(quiz.title);
      quiz.coverImage = coverImage;
      await quiz.save().catch(() => {});
    }

    return {
      message: 'Quiz review loaded successfully',
      data: {
        quiz: {
          quizId: quiz.quizId,
          title: quiz.title,
          coverImage: coverImage || '',
          pin: quiz.pin,
          isDeployed: Boolean(quiz.isDeployed),
          status: quiz.status,
          deploymentType: quiz.deploymentType,
          accessMode: quiz.accessMode,
          scheduledFor: quiz.scheduledFor,
          liveDurationMinutes: quiz.liveDurationMinutes,
          liveUntil: quiz.liveUntil,
          totalQuestions, // Count ONLY - NO questions array!
          questime: quiz.questime,
          createdAt: (quiz as any).createdAt,
          antiCheat: quiz.antiCheat,
        },
        owner: {
          username: creator?.username || 'QuizzCraft Creator',
          fullName: creator?.fullName || creator?.username || 'Creator',
          avatar: creator?.profilePicture || '',
          isCurrentUser: isOwner,
        },
        stats: {
          totalAttempts,
          completedAttempts: completedCount,
          activeAttempts,
          averageScore,
          highestScore,
          lowestScore,
          passRate,
        },
        leaderboard,
        isOwner,
        isPublic,
        canAttempt: Boolean(canAttempt),
      },
    };
  }
}

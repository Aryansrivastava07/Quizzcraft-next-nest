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
  copyQuizDto,
} from './dto/quiz.request.dto';
import { ServiceResponse } from '../common/interfaces/service-response.interface';
import { generateQuizResponseData } from './dto/quiz.response.dto';
import { AI_PROVIDER } from '../ai/ai.constants';
import type { AiProvider } from '../ai/interfaces/ai-provider.interface';
import { IAiGeneratedQuizResponse } from '../common/interfaces/quiz.interface'; // Renamed interface
import { IQuiz } from '../common/interfaces/quiz-types.interface'; // New core interface
import { Attempts } from '../schemas/attempts.schema';
import { resolveQuizRelatedImage } from './utils/quiz-image.util';
import { checkIsCorrect, deriveTopic } from '../common/utils/quiz.util';

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

        const isPracticeBool = dto.isPractice === true || dto.isPractice === 'true';
        let orgId = dto.orgId ? String(dto.orgId).trim() : null;
        let isPractice = isPracticeBool;

        if (owner?.ownerId) {
          const user = await this.UserModel.findById(owner.ownerId).lean();
          if (user) {
            const isStudent = user.role === 'ORG_STD' || (user.role as string) === 'ORG_USER';
            if (isStudent && orgId) {
              isPractice = true;
            }
          }
        }

        const newQuiz: IQuiz = {
          quizId: randomUUID(),
          pin,
          title: generatedQuiz.quiz.title,
          topic: deriveTopic(generatedQuiz.quiz.title, questions),
          coverImage,
          ownerId: owner?.ownerId,
          ownerEmail: owner?.ownerEmail,
          isDeployed: false,
          status: 'DRAFT',
          accessMode: orgId ? 'ORGANIZATION' : 'PUBLIC',
          immediateResult: true,
          questime: 60,
          dynamicShuffle: true,
          temporalLimit: true,
          questions,
          orgId: orgId || null,
          isPractice,
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

    // 0. Check if Quiz has been Deployed Live
    const isDraft = quiz.status === 'DRAFT' || (!quiz.isDeployed && quiz.status !== 'ANYTIME' && quiz.status !== 'LIVE' && quiz.status !== 'SCHEDULED');
    if (isDraft) {
      return {
        message: 'Quiz has not been deployed yet',
        data: {
          isUndeployed: true,
          isDraft: true,
          isLive: false,
          quizId: quiz.quizId,
          title: quiz.title,
          pin: quiz.pin,
          status: quiz.status || 'DRAFT',
          message: 'This quiz is currently a draft and has not been deployed yet. Please wait for the host to launch it live before entering.',
        },
      };
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
      orgId?: string | null;
      isPractice?: boolean;
      groupId?: string | null;
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
    if (updateData.orgId !== undefined) {
      setPayload.orgId = updateData.orgId;
    }
    if (updateData.isPractice !== undefined) {
      setPayload.isPractice = Boolean(updateData.isPractice);
    }
    if (updateData.groupId !== undefined) {
      setPayload.groupId = updateData.groupId;
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
    if (updateData.status !== undefined) {
      setPayload.status = updateData.status;
      if (updateData.status === 'DRAFT') {
        setPayload.isDeployed = false;
      } else if (['LIVE', 'ANYTIME', 'SCHEDULED'].includes(updateData.status)) {
        setPayload.isDeployed = true;
      }
    } else if (updateData.isDeployed !== undefined) {
      setPayload.isDeployed = Boolean(updateData.isDeployed);
      if (!updateData.isDeployed) {
        setPayload.status = 'DRAFT';
      }
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

    const isOwner = quiz.ownerId && String(quiz.ownerId) === String(userId);
    const now = new Date();

    // Check if undeployed or draft
    const isDraft = quiz.status === 'DRAFT' || (!quiz.isDeployed && quiz.status !== 'ANYTIME' && quiz.status !== 'LIVE');
    if (isDraft) {
      if (!isOwner) {
        throw new BadRequestException('This quiz is currently in draft mode and has not been deployed yet. Please wait for the host to launch it before entering.');
      }
    }

    // Check if scheduled and not started yet
    if (quiz.status === 'SCHEDULED' && quiz.scheduledFor && now < new Date(quiz.scheduledFor)) {
      if (!isOwner) {
        throw new BadRequestException('This quiz is scheduled and is not yet live. Please wait for the scheduled start time.');
      }
    }

    // Check if ended
    if (quiz.status === 'ENDED' || (quiz.liveUntil && now > new Date(quiz.liveUntil))) {
      throw new BadRequestException('This quiz arena session has concluded and is no longer accepting new attempts.');
    }

    const lastSession = await this.AttemptsModel.findOne({
      userId,
      quizId: dto.quizId,
      isActive: true,
    });

    const timeBufferAllowed = 5 * 60 * 1000;

    if (lastSession) {
      const lastUpdatedAt = new Date(lastSession.lastUpdateAt).getTime();
      const isExpired = now.getTime() - lastUpdatedAt >= timeBufferAllowed;

      if (!isExpired) {
        return {
          message: 'An active session already exists',
          data: {
            session: lastSession,
            createSession: lastSession,
          },
        };
      }

      await this.AttemptsModel.updateOne(
        { sessionId: lastSession.sessionId },
        { isActive: false },
      );
    }

    const sessionId = randomUUID();
    const nowIso = new Date().toISOString();
    const createSession = await this.AttemptsModel.create({
      sessionId,
      quizId: dto.quizId,
      userId,
      isActive: true,
      lastUpdateAt: nowIso,
      startedAt: nowIso,
      totalTimeSpentSeconds: 0,
      score: 0,
      accuracy: 0,
      Responses: [],
    });

    return {
      message: 'Attempt session created',
      data: {
        session: createSession,
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
    const userChoice: string[] = dto.option ? [dto.option] : [];
    const newResponse = {
      questionId: dto.questionId,
      chosenOption: userChoice,
      timeSpentSeconds: typeof dto.timeSpentSeconds === 'number' ? dto.timeSpentSeconds : 0,
    };

    if (existingIndex >= 0) {
      if (dto.option) {
        updatedResponses[existingIndex] = newResponse;
      }
    } else if (dto.option) {
      updatedResponses.push(newResponse);
    }

    await this.AttemptsModel.updateOne(
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
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new UnauthorizedException('User not Authorized');
    }

    const updatedResponses = [...session.Responses];
    if (dto.questionId) {
      const existingIndex = updatedResponses.findIndex(
        (response) => response.questionId === dto.questionId,
      );
      const userChoice: string[] = dto.option ? [dto.option] : [];
      const newResponse = {
        questionId: dto.questionId,
        chosenOption: userChoice,
        timeSpentSeconds: typeof dto.timeSpentSeconds === 'number' ? dto.timeSpentSeconds : 0,
      };

      if (existingIndex >= 0) {
        if (dto.option) {
          updatedResponses[existingIndex] = newResponse;
        }
      } else if (dto.option) {
        updatedResponses.push(newResponse);
      }
    }

    // Evaluate score and accuracy directly upon submission
    const quiz = await this.QuizModel.findOne({ quizId: session.quizId });
    let score = 0;
    if (quiz?.questions) {
      updatedResponses.forEach((response) => {
        const questionId = response.questionId;
        const q = quiz.questions.find((question) => question.questionId === questionId);
        if (q && response.chosenOption?.[0]) {
          if (checkIsCorrect(response.chosenOption[0], q.answer, q.options)) {
            score++;
          }
        }
      });
    }

    const totalQuestions = quiz?.questions?.length || 0;
    const accuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    let totalTimeSpentSeconds =
      typeof dto.totalTimeSpentSeconds === 'number' && dto.totalTimeSpentSeconds > 0
        ? dto.totalTimeSpentSeconds
        : 0;

    if (!totalTimeSpentSeconds) {
      if (session.startedAt) {
        totalTimeSpentSeconds = Math.max(
          1,
          Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000),
        );
      } else if (session.lastUpdateAt) {
        totalTimeSpentSeconds = Math.max(
          1,
          Math.round((Date.now() - new Date(session.lastUpdateAt).getTime()) / 1000),
        );
      }
    }

    const updatePayload: any = {
      Responses: updatedResponses,
      lastUpdateAt: new Date().toISOString(),
      isActive: false,
      score,
      accuracy,
      totalTimeSpentSeconds,
    };

    if (typeof dto.tabSwitchesCount === 'number') {
      updatePayload.tabSwitchesCount = dto.tabSwitchesCount;
    }
    if (typeof dto.copyAttemptsCount === 'number') {
      updatePayload.copyAttemptsCount = dto.copyAttemptsCount;
    }
    if (typeof dto.fullscreenExitsCount === 'number') {
      updatePayload.fullscreenExitsCount = dto.fullscreenExitsCount;
    }
    if (Array.isArray(dto.antiCheatLogs) && dto.antiCheatLogs.length > 0) {
      updatePayload.antiCheatLogs = dto.antiCheatLogs;
    }

    await this.AttemptsModel.updateOne(
      { sessionId },
      updatePayload,
    );

    const userAttempts = await this.AttemptsModel.find({
      userId,
      isActive: false,
    });
    const quizAttempted = userAttempts.length;
    const totalScoreSum = userAttempts.reduce(
      (acc, curr) => acc + (typeof curr.score === 'number' ? curr.score : 0),
      0,
    );
    const newAverageScore = quizAttempted > 0 ? Math.round(totalScoreSum / quizAttempted) : score;
    await this.UserModel.updateOne({ _id: userId }, { quizAttempted, averageScore: newAverageScore });

    return {
      message: 'Quiz Submitted',
      data: {
        score,
        accuracy,
        totalTimeSpentSeconds,
      },
    };
  }

  async logAntiCheatEvent(
    sessionId: string,
    dto: { eventType: string; details?: string; timestamp?: string },
    userId: string,
  ): Promise<ServiceResponse<any>> {
    const session = await this.AttemptsModel.findOne({ sessionId });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) throw new UnauthorizedException();

    const timestamp = dto.timestamp || new Date().toISOString();
    const eventType = dto.eventType || 'TAB_SWITCH';
    const details = dto.details || '';

    const newLog = { eventType, timestamp, details };
    const incField: any = {};
    if (eventType === 'TAB_SWITCH') incField.tabSwitchesCount = 1;
    else if (eventType === 'COPY_ATTEMPT') incField.copyAttemptsCount = 1;
    else if (eventType === 'FULLSCREEN_EXIT') incField.fullscreenExitsCount = 1;

    await this.AttemptsModel.updateOne(
      { sessionId },
      {
        $push: { antiCheatLogs: newLog },
        $inc: incField,
        $set: { lastUpdateAt: new Date().toISOString() },
      },
    );

    return {
      message: 'Anti-cheat event logged',
      data: true,
    };
  }

  async getAttemptResult(sessionId: string, userId: string) {
    const session = await this.AttemptsModel.findOne({ sessionId });
    if (!session) {
      throw new NotFoundException('Quiz attempt session not found');
    }

    const quiz = await this.QuizModel.findOne({ quizId: session.quizId });
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    const isSessionOwner = String(session.userId) === String(userId);
    const isQuizOwner = quiz.ownerId && String(quiz.ownerId) === String(userId);

    if (!isSessionOwner && !isQuizOwner) {
      throw new UnauthorizedException('Not authorized to view this attempt result');
    }

    // Auto-finalize attempt if viewed
    if (session.isActive) {
      await this.AttemptsModel.updateOne({ sessionId }, { isActive: false });
      session.isActive = false;
    }

    const cadetUser = await this.UserModel.findById(session.userId)
      .select('username fullName profilePicture email xp')
      .lean();

    const totalQuestions = quiz.questions?.length || 0;

    // Calculate score and accuracy if not saved or 0
    let score = typeof session.score === 'number' ? session.score : 0;
    if (session.score === null || session.score === undefined || session.score === 0) {
      score = 0;
      session.Responses.forEach((response) => {
        const q = quiz.questions?.find((question) => question.questionId === response.questionId);
        if (q && response.chosenOption?.[0]) {
          if (checkIsCorrect(response.chosenOption[0], q.answer, q.options)) {
            score++;
          }
        }
      });
      await this.AttemptsModel.updateOne({ sessionId }, { score, isActive: false });
    }

    const accuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const correctCount = score;
    const incorrectCount = Math.max(0, totalQuestions - score);

    let totalTimeSpentSeconds = session.totalTimeSpentSeconds || 0;
    if (!totalTimeSpentSeconds) {
      if (session.startedAt && session.lastUpdateAt) {
        totalTimeSpentSeconds = Math.max(
          1,
          Math.round(
            (new Date(session.lastUpdateAt).getTime() - new Date(session.startedAt).getTime()) / 1000,
          ),
        );
      } else {
        totalTimeSpentSeconds = Math.max(1, totalQuestions * 30);
      }
    }

    const averageTimePerQuestion =
      totalQuestions > 0 ? Number((totalTimeSpentSeconds / totalQuestions).toFixed(1)) : 0;

    // Query all completed attempts for leaderboard & ranking
    const allAttempts = await this.AttemptsModel.find({
      quizId: session.quizId,
      isActive: false,
    }).lean();

    const totalParticipants = Math.max(1, allAttempts.length);
    const participantUserIds = allAttempts.map((a) => a.userId).filter(Boolean);
    const participants = await this.UserModel.find({ _id: { $in: participantUserIds } })
      .select('username fullName profilePicture')
      .lean();
    const pMap = new Map(participants.map((p) => [String(p._id), p]));

    const sortedAttempts = [...allAttempts].sort((a, b) => {
      const scoreA = typeof a.score === 'number' ? a.score : 0;
      const scoreB = typeof b.score === 'number' ? b.score : 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const timeA = a.totalTimeSpentSeconds || 99999;
      const timeB = b.totalTimeSpentSeconds || 99999;
      return timeA - timeB;
    });

    const rankIndex = sortedAttempts.findIndex((a) => a.sessionId === sessionId);
    const rank = rankIndex >= 0 ? rankIndex + 1 : 1;
    const percentile =
      totalParticipants > 0
        ? Math.round(((totalParticipants - rank + 1) / totalParticipants) * 100)
        : 100;

    let grade = 'F';
    if (accuracy >= 95) grade = 'A+';
    else if (accuracy >= 85) grade = 'A';
    else if (accuracy >= 75) grade = 'B+';
    else if (accuracy >= 65) grade = 'B';
    else if (accuracy >= 50) grade = 'C';

    const questionsBreakdown = (quiz.questions || []).map((q, idx) => {
      const userResp = session.Responses.find((r) => r.questionId === q.questionId);
      const chosen = userResp?.chosenOption?.[0] || null;
      const isCorrect = checkIsCorrect(chosen, q.answer, q.options);

      return {
        id: idx + 1,
        questionId: q.questionId,
        question: q.question,
        options: q.options || [],
        userAnswer: chosen,
        correctAnswer: q.answer,
        isCorrect,
        explanation: q.explanation || '',
        level: q.level || 'MEDIUM',
        xp: q.xp || 200,
        timeSpentSeconds: userResp?.timeSpentSeconds || averageTimePerQuestion,
        reference: q.reference,
      };
    });

    const leaderboard = sortedAttempts.map((att, idx) => {
      const cadet = pMap.get(String(att.userId));
      const s = typeof att.score === 'number' ? att.score : 0;
      const p = totalQuestions > 0 ? Math.round((s / totalQuestions) * 100) : 0;
      const t = att.totalTimeSpentSeconds || totalQuestions * 30;
      return {
        rank: idx + 1,
        sessionId: att.sessionId,
        userId: att.userId,
        username: cadet?.username || 'Cadet Pilot',
        fullName: cadet?.fullName || cadet?.username || 'Cadet Pilot',
        avatar: cadet?.profilePicture || '',
        score: s,
        percentage: p,
        totalTimeSpentSeconds: t,
        avgResponseTime: totalQuestions > 0 ? Number((t / totalQuestions).toFixed(1)) : 0,
        isCurrentUser: att.sessionId === sessionId,
      };
    });

    return {
      message: 'Attempt result loaded',
      data: {
        attempt: {
          sessionId: session.sessionId,
          quizId: session.quizId,
          score,
          totalQuestions,
          accuracy,
          correctCount,
          incorrectCount,
          unansweredCount: Math.max(0, totalQuestions - session.Responses.length),
          totalTimeSpentSeconds,
          averageTimePerQuestion,
          rank,
          totalParticipants,
          percentile,
          grade,
          user: {
            username: cadetUser?.username || 'Cadet',
            fullName: cadetUser?.fullName || cadetUser?.username || 'Cadet',
            avatar: cadetUser?.profilePicture || '',
          },
        },
        quiz: {
          quizId: quiz.quizId,
          title: quiz.title,
          coverImage: quiz.coverImage,
          pin: quiz.pin,
          questime: quiz.questime || 60,
          totalQuestions,
        },
        questions: questionsBreakdown,
        leaderboard,
      },
    };
  }

  async getLatestAttemptResult(quizId: string | undefined, userId: string) {
    const filter: any = { userId };
    if (quizId) {
      filter.quizId = quizId;
    }
    let latestAttempt = await this.AttemptsModel.findOne({ ...filter, isActive: false }).sort({
      updatedAt: -1,
      lastUpdateAt: -1,
      _id: -1,
    });

    if (!latestAttempt) {
      latestAttempt = await this.AttemptsModel.findOne(filter).sort({
        updatedAt: -1,
        lastUpdateAt: -1,
        _id: -1,
      });
    }

    if (!latestAttempt) {
      throw new NotFoundException('No completed attempt found');
    }

    return this.getAttemptResult(latestAttempt.sessionId, userId);
  }

  async getScore(sessionId: string, userId: string) {
    const user = await this.UserModel.findById(userId);
    const session = await this.AttemptsModel.findOne({ sessionId });
    if (!user || session?.userId != userId) throw new UnauthorizedException();
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    const quiz = await this.QuizModel.findOne({ quizId: session.quizId });
    let score = 0;
    session.Responses.forEach((response) => {
      const questionId = response.questionId;
      const q = quiz?.questions.find((question) => question.questionId === questionId);
      if (q && response.chosenOption?.[0]) {
        if (checkIsCorrect(response.chosenOption[0], q.answer, q.options)) {
          score++;
        }
      }
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

    const isStudentUser = user.role === 'ORG_STD' || (user.role as string) === 'ORG_USER';

    // Strict RBAC on Deploy:
    // If the quiz is an organization quiz (quiz.orgId exists) and user is a learner,
    // they are forbidden from deploying it (training and peer sharing only).
    if (quiz.orgId && isStudentUser) {
      throw new ForbiddenException(
        'Learners cannot deploy organization quizzes. Quizzes created inside an organization workspace are for personal training and peer sharing only.',
      );
    }

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

    const orgIdFinal = quiz.orgId || (dto.groupId ? user.orgId : null);
    const isOrgQuiz = Boolean(orgIdFinal);
    const isOrgStudentQuiz = isOrgQuiz && isStudentUser;
    const isPracticeFinal = isOrgStudentQuiz ? true : (dto.isPractice ?? false);

    // Strict workspace isolation: an organization quiz cannot be marked PUBLIC; a non-org quiz cannot be marked ORGANIZATION
    let accessModeFinal: 'PUBLIC' | 'PRIVATE' | 'ORGANIZATION';
    if (isOrgQuiz) {
      accessModeFinal = isOrgStudentQuiz ? 'PRIVATE' : 'ORGANIZATION';
    } else {
      accessModeFinal = dto.accessMode === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC';
    }

    const groupIdFinal = (!isStudentUser && dto.groupId) ? dto.groupId : null;
    const dueDateFinal = (!isStudentUser && dto.dueDate) ? new Date(dto.dueDate) : null;

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
          orgId: orgIdFinal || null,
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
        adminUrl: `/quiz/review/${encodeURIComponent(quizId)}`,
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
      orgId: { $in: [null, ''] },
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
        antiCheat: Boolean(q.antiCheat),
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
      averageTimeSeconds?: number;
      averageTimePerQuestion?: number;
      totalCorrectAnswers?: number;
      totalIncorrectAnswers?: number;
      overallCorrectRate?: number;
      overallIncorrectRate?: number;
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
    let totalTimeSum = 0;
    let totalCorrectAnswers = 0;
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
          totalCorrectAnswers += score;

          const attemptTime =
            attempt.totalTimeSpentSeconds ||
            (attempt.startedAt && attempt.lastUpdateAt
              ? Math.max(
                  1,
                  Math.round(
                    (new Date(attempt.lastUpdateAt).getTime() -
                      new Date(attempt.startedAt).getTime()) /
                      1000,
                  ),
                )
              : Math.max(1, totalQuestions * 30));

          totalTimeSum += attemptTime;
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
          tabSwitchesCount: (attempt as any).tabSwitchesCount || 0,
          copyAttemptsCount: (attempt as any).copyAttemptsCount || 0,
          fullscreenExitsCount: (attempt as any).fullscreenExitsCount || 0,
          antiCheatLogs: isOwner ? ((attempt as any).antiCheatLogs || []) : [],
        };
      })
      .sort((a, b) => b.score - a.score || b.percentage - a.percentage);

    const averageScore = completedCount > 0 ? Math.round(totalScoreSum / completedCount) : 0;
    const highestScore = numericScores.length > 0 ? Math.max(...numericScores) : 0;
    const lowestScore = numericScores.length > 0 ? Math.min(...numericScores) : 0;
    const passThreshold = totalQuestions * 0.5;
    const passedCount = numericScores.filter((s) => s >= passThreshold).length;
    const passRate = completedCount > 0 ? Math.round((passedCount / completedCount) * 100) : 0;

    // Aggregate metrics across all attempts for creator review
    const totalAttemptedQuestions = completedCount * totalQuestions;
    const totalIncorrectAnswers = Math.max(0, totalAttemptedQuestions - totalCorrectAnswers);
    const overallCorrectRate =
      totalAttemptedQuestions > 0
        ? Math.round((totalCorrectAnswers / totalAttemptedQuestions) * 100)
        : 0;
    const overallIncorrectRate = totalAttemptedQuestions > 0 ? 100 - overallCorrectRate : 0;
    const averageTimeSeconds =
      completedCount > 0 ? Math.round(totalTimeSum / completedCount) : 0;
    const averageTimePerQuestion =
      completedCount > 0 && totalQuestions > 0
        ? Number((averageTimeSeconds / totalQuestions).toFixed(1))
        : 0;

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
          averageTimeSeconds,
          averageTimePerQuestion,
          totalCorrectAnswers,
          totalIncorrectAnswers,
          overallCorrectRate,
          overallIncorrectRate,
        },
        leaderboard,
        isOwner,
        isPublic,
        canAttempt: Boolean(canAttempt),
      },
    };
  }

  async copyQuiz(
    quizId: string,
    userId: string,
    dto: copyQuizDto,
  ): Promise<ServiceResponse<any>> {
    const originalQuiz = await this.QuizModel.findOne({ quizId });
    if (!originalQuiz) {
      throw new NotFoundException('Quiz not found');
    }

    const user = await this.UserModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Permission check: owner of quiz, super admin, or org admin if inside org
    const isOwner =
      originalQuiz.ownerId === userId ||
      (originalQuiz.ownerEmail && originalQuiz.ownerEmail.toLowerCase() === user.email.toLowerCase());
    const isSuper = user.role === 'SUPER_ADMIN' || (user as any).isSuperAdmin;
    const isOrgAdminOfQuiz =
      originalQuiz.orgId &&
      user.orgId === originalQuiz.orgId &&
      user.role === 'ORG_ADMIN';

    if (!isOwner && !isSuper && !isOrgAdminOfQuiz) {
      // Allow copying if it's a public quiz (any user can clone a public quiz into their own workspace/sandbox)
      if (originalQuiz.accessMode !== 'PUBLIC') {
        throw new ForbiddenException('Only the owner or authorized administrator can copy this assessment');
      }
    }

    const targetWorkspace = dto.targetWorkspace || 'PUBLIC';
    let newAccessMode: 'PUBLIC' | 'PRIVATE' | 'ORGANIZATION' = 'PUBLIC';
    let newOrgId: string | null = null;
    let newOrganizationDomain: string | null = null;
    let isPractice = false;

    if (targetWorkspace === 'ORGANIZATION') {
      const targetOrgId = dto.orgId || user.orgId;
      if (!targetOrgId) {
        throw new BadRequestException('Target organization ID is required to copy a quiz into an organization workspace');
      }

      if (!isSuper && user.orgId !== targetOrgId) {
        throw new ForbiddenException('You are not a member of the target organization');
      }

      newAccessMode = 'ORGANIZATION';
      newOrgId = targetOrgId;
      isPractice = user.role === 'ORG_STD' || (user.role as string) === 'ORG_USER';
    } else if (targetWorkspace === 'PRIVATE') {
      newAccessMode = 'PRIVATE';
      newOrgId = null;
      isPractice = false;
    } else {
      // PUBLIC
      newAccessMode = 'PUBLIC';
      newOrgId = null;
      isPractice = false;
    }

    const newPin = await this.generateUniquePin();
    const newQuizId = randomUUID();
    const newTitle = dto.title?.trim() || `Copy of ${originalQuiz.title}`;

    const newQuestions = (originalQuiz.questions || []).map((q, idx) => ({
      questionId: randomUUID(),
      question: q.question,
      options: [...(q.options || [])],
      answer: q.answer,
      explanation: q.explanation || '',
      level: q.level || (idx % 3 === 0 ? 'EASY' : idx % 3 === 1 ? 'MEDIUM' : 'HARD'),
      xp: q.xp || 200,
      reference: q.reference ? { ...q.reference } : undefined,
    }));

    const copiedQuizDoc = await (this.QuizModel as any).create({
      quizId: newQuizId,
      pin: newPin,
      title: newTitle,
      topic: (originalQuiz as any).topic || deriveTopic(newTitle, newQuestions),
      coverImage: originalQuiz.coverImage || '',
      ownerId: userId,
      ownerEmail: user.email,
      accessMode: newAccessMode,
      orgId: newOrgId,
      organizationDomain: newOrganizationDomain || undefined,
      deploymentType: originalQuiz.deploymentType || 'ANYTIME',
      isDeployed: false,
      status: 'DRAFT',
      isPractice,
      antiCheat: originalQuiz.antiCheat ?? true,
      fullScreenLock: originalQuiz.fullScreenLock ?? true,
      shuffleChoices: originalQuiz.shuffleChoices ?? true,
      allowRetries: originalQuiz.allowRetries ?? false,
      immediateResult: originalQuiz.immediateResult ?? true,
      questime: originalQuiz.questime || 60,
      dynamicShuffle: originalQuiz.dynamicShuffle ?? true,
      temporalLimit: originalQuiz.temporalLimit ?? true,
      questions: newQuestions,
    });

    const quizObj = (copiedQuizDoc as any)?.toObject
      ? (copiedQuizDoc as any).toObject()
      : copiedQuizDoc;

    return {
      message: 'Quiz copy created successfully',
      data: {
        quiz: quizObj,
      },
    };
  }
}

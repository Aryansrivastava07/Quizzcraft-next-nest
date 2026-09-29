import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Param,
  Get,
  Put,
  Delete,
  Request,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import JWT from 'jsonwebtoken';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type {} from 'multer'; // Type-only import without runtime dependency
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { SanitizeInterceptor } from '../common/interceptors/sanitize.interceptor';
import {
  generateQuizDto,
  attemptQuizDto,
  answerQuizDto,
  editQuestionDto,
  deployQuizDto,
} from './dto/quiz.request.dto';
import { QuizService } from './quiz.service';

@Controller('api/quiz')
@UseInterceptors(LoggingInterceptor, SanitizeInterceptor)
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly configService: ConfigService,
  ) {}
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('generate')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 5 },
        { name: 'videos', maxCount: 1 },
        { name: 'pdfs', maxCount: 2 },
      ],
      {
        limits: {
          fileSize: 50 * 1024 * 1024, // 50MB per file to support PDFs, diagrams, and video
        },
      },
    ),
  )
  async generateQuiz(
    @Request() req,
    @Body() dto: generateQuizDto,
    @UploadedFiles()
    files: {
      images?: Express.Multer.File[];
      videos?: Express.Multer.File[];
      pdfs?: Express.Multer.File[];
    },
  ) {
    const ownerId = req.user?.userId;
    const ownerEmail = req.user?.email;
    return this.quizService.generateQuiz({ ...dto, ...files }, { ownerId, ownerEmail });
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Get('attempt/:quizId')
  async createAttempt(@Param() dto: attemptQuizDto, @Request() req) {
    const userId = req.user.userId;
    return this.quizService.createAttempt(dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('attempt/answer/:sessionId')
  async updateResponse(
    @Param('sessionId') sessionId: string,
    @Body() dto: answerQuizDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.quizService.updateResponse(sessionId, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('attempt/submit/:sessionId')
  async SubmitResponse(
    @Param('sessionId') sessionId: string,
    @Body() dto: answerQuizDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.quizService.submitResponse(sessionId, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Get('score/:sessionId')
  async GetScore(
    @Param('sessionId') sessionId: string,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.quizService.getScore(sessionId, userId);
  }

  @HttpCode(200)
  @Get('pin/:pin')
  async getQuizByPin(@Param('pin') pin: string, @Query('email') email?: string) {
    return this.quizService.getQuizByPin(pin, email);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post(':quizId/deploy')
  async deployQuiz(
    @Param('quizId') quizId: string,
    @Body() dto: deployQuizDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.quizService.deployQuiz(quizId, userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Get(':quizId/admin')
  async getQuizAdminData(
    @Param('quizId') quizId: string,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.quizService.getQuizAdminData(quizId, userId);
  }

  @HttpCode(200)
  @Post(':quizId/waitlist')
  async joinWaitlist(
    @Param('quizId') quizId: string,
    @Body('email') email: string,
  ) {
    return this.quizService.joinWaitlist(quizId, email);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post(':quizId/close')
  async closeQuiz(
    @Param('quizId') quizId: string,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.quizService.closeQuiz(quizId, userId);
  }

  @HttpCode(200)
  @Get('public')
  async getPublicQuizzes(@Query() query: { search?: string; status?: string; page?: string; limit?: string }) {
    return this.quizService.getPublicQuizzes({
      search: query.search,
      status: query.status,
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 24,
    });
  }

  @HttpCode(200)
  @Get(':quizId/review')
  async getQuizReview(
    @Param('quizId') quizId: string,
    @Req() req: any,
  ) {
    let currentUserId: string | undefined;
    const token = req?.cookies?.accessToken;
    if (token) {
      try {
        const secretKey = this.configService.get<string>('JWT_ACCESS_SECRET');
        if (secretKey) {
          const payload: any = JWT.verify(token, secretKey);
          currentUserId = payload?.userId;
        }
      } catch {
        // Anonymous visitor
      }
    }
    return this.quizService.getQuizReview(quizId, currentUserId);
  }

  @HttpCode(200)
  @Get(':quizId')
  async getQuiz(@Param('quizId') quizId: string) {
    return this.quizService.getQuiz(quizId);
  }

  @HttpCode(200)
  @Put(':quizId')
  async updateQuiz(
    @Param('quizId') quizId: string,
    @Body()
    body: {
      title?: string;
      coverImage?: string;
      questions?: any[];
      immediateResult?: boolean;
      questime?: number;
      dynamicShuffle?: boolean;
      temporalLimit?: boolean;
    },
  ) {
    return this.quizService.updateQuiz(quizId, body);
  }

  @HttpCode(200)
  @Put(':quizId/question/:questionId')
  async editQuestion(
    @Param('quizId') quizId: string,
    @Param('questionId') questionId: string,
    @Body() dto: editQuestionDto,
  ) {
    return this.quizService.editQuestion(quizId, questionId, dto);
  }

  @HttpCode(200)
  @Post(':quizId/question')
  async addQuestion(
    @Param('quizId') quizId: string,
    @Body() dto: { question: string; options: string[]; answer: string; explanation?: string; level?: string },
  ) {
    return this.quizService.addQuestion(quizId, dto);
  }

  @HttpCode(200)
  @Delete(':quizId/question/:questionId')
  async deleteQuestion(
    @Param('quizId') quizId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.quizService.deleteQuestion(quizId, questionId);
  }
}

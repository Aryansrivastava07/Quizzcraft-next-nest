import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Quiz } from '../schemas/quiz.schema';
import { MailService } from '../mail/mail.service';

@Injectable()
export class QuizSchedulerService {
  private readonly logger = new Logger(QuizSchedulerService.name);

  constructor(
    @Inject('QUIZ_MODEL') private readonly QuizModel: Model<Quiz>,
    private readonly mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledQuizzes() {
    const now = new Date();
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

    try {
      // 1. Dispatch 5-minute pre-launch reminder email to quiz owner
      const upcomingQuizzes = await this.QuizModel.find({
        status: 'SCHEDULED',
        scheduledAlertSent: { $ne: true },
        scheduledFor: { $lte: fiveMinutesLater, $gte: now },
      });

      for (const quiz of upcomingQuizzes) {
        if (quiz.ownerEmail) {
          try {
            await this.mailService.sendScheduledQuizAlertEmail({
              ownerEmail: quiz.ownerEmail,
              quizTitle: quiz.title,
              quizId: quiz.quizId,
              pin: quiz.pin || '',
              scheduledFor: quiz.scheduledFor!,
              waitingCadetsCount: quiz.waitingList?.length || 0,
            });
            this.logger.log(
              `5-minute alert sent to owner (${quiz.ownerEmail}) for quiz ${quiz.quizId}`,
            );
          } catch (mailErr) {
            this.logger.error(
              `Failed sending 5-min alert to ${quiz.ownerEmail}:`,
              mailErr,
            );
          }
        }
        await this.QuizModel.updateOne(
          { quizId: quiz.quizId },
          { $set: { scheduledAlertSent: true } },
        );
      }

      // 2. Automatically launch quizzes whose scheduled launch time has arrived
      const quizzesToLaunch = await this.QuizModel.find({
        status: 'SCHEDULED',
        scheduledFor: { $lte: now },
      });

      for (const quiz of quizzesToLaunch) {
        const durationMinutes = quiz.liveDurationMinutes || 60;
        const liveUntil = new Date(now.getTime() + durationMinutes * 60 * 1000);

        await this.QuizModel.updateOne(
          { quizId: quiz.quizId },
          {
            $set: {
              status: 'LIVE',
              liveUntil,
            },
          },
        );
        this.logger.log(
          `Scheduled quiz ${quiz.quizId} has gone LIVE until ${liveUntil.toISOString()}`,
        );
      }

      // 3. Automatically conclude quizzes whose live window has expired
      const expiredQuizzes = await this.QuizModel.find({
        status: 'LIVE',
        liveUntil: { $lte: now, $ne: null },
      });

      for (const quiz of expiredQuizzes) {
        await this.QuizModel.updateOne(
          { quizId: quiz.quizId },
          { $set: { status: 'ENDED' } },
        );
        this.logger.log(`Live quiz ${quiz.quizId} expired and set to ENDED`);
      }
    } catch (err) {
      this.logger.error('Error in handleScheduledQuizzes cron cycle:', err);
    }
  }
}

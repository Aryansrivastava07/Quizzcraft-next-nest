import { Module } from '@nestjs/common';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { QuizProviders } from './quiz.provider';
import { DbModule } from '../db/db.module';
import { AiModule } from '../ai/ai.module';
import { MailModule } from '../mail/mail.module';
import { QuizSchedulerService } from './quiz-scheduler.service';

@Module({
  imports: [DbModule, AiModule, MailModule],
  controllers: [QuizController],
  providers: [QuizService, QuizSchedulerService, ...QuizProviders],
})
export class QuizModule {}


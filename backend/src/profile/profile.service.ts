import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ServiceResponse } from '../common/interfaces/service-response.interface';
import {
  getProfileDto,
  updateProfileDto,
  updateSettingsDto,
  createSupportTicketDto,
} from './dto/profile.request.dto';
import { User } from '../schemas/user.schema';
import { Model } from 'mongoose';
import { Quiz } from '../schemas/quiz.schema';
import { Attempts } from '../schemas/attempts.schema';
import { Ticket } from '../schemas/ticket.schema';
import { MailService } from '../mail/mail.service';
import { checkIsCorrect, deriveTopic } from '../common/utils/quiz.util';

@Injectable()
export class ProfileService {
  constructor(
    @Inject('USER_MODEL') private UserModel: Model<User>,
    @Inject('QUIZ_MODEL') private QuizModel: Model<Quiz>,
    @Inject('ATTEMPTS_MODEL') private AttemptsModel: Model<Attempts>,
    @Inject('TICKET_MODEL') private TicketModel: Model<Ticket>,
    private readonly mailService: MailService,
  ) {}

  async checkUsernameAvailability(
    rawUsername: string,
    currentUserId?: string,
  ): Promise<
    ServiceResponse<{
      available: boolean;
      valid: boolean;
      isCurrent?: boolean;
      message: string;
    }>
  > {
    const username = (rawUsername || '').toLowerCase().trim();
    if (!/^[a-z0-9]{3,30}$/.test(username)) {
      return {
        message: 'Invalid username format',
        data: {
          available: false,
          valid: false,
          message:
            'Username must be 3-30 lowercase alphanumeric characters with no special symbols',
        },
      };
    }

    const existingUser = await this.UserModel.findOne({ username });
    if (existingUser) {
      if (currentUserId && String(existingUser._id) === String(currentUserId)) {
        return {
          message: 'Current username',
          data: {
            available: true,
            valid: true,
            isCurrent: true,
            message: 'This is your current username',
          },
        };
      }
      return {
        message: 'Username taken',
        data: {
          available: false,
          valid: true,
          isCurrent: false,
          message: 'Username is already taken',
        },
      };
    }

    return {
      message: 'Username available',
      data: {
        available: true,
        valid: true,
        isCurrent: false,
        message: 'Username is available',
      },
    };
  }

  async getProfile(
    dto: getProfileDto,
  ): Promise<ServiceResponse<any>> {
    const { email } = dto;
    const user = await this.UserModel.findOne({
      $or: [{ email: email }, { emails: email }],
    })
      .select('-password -verificationId -verificationIdExpiry -refreshToken')
      .lean();
    if (!user) {
      return { message: 'User not found', data: {} };
    }
    const populatedUser = {
      ...user,
      emails: Array.isArray((user as any).emails) && (user as any).emails.length > 0
        ? (user as any).emails
        : [(user as any).email],
    };
    return {
      message: 'User profile found',
      data: populatedUser,
    };
  }

  async UpdateProfile(
    dto: updateProfileDto,
  ): Promise<ServiceResponse<any>> {
    const { email } = dto;
    try {
      const user = await this.UserModel.findOne({ email: email });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (dto.userName !== undefined) {
        const cleanUserName = dto.userName.toLowerCase().trim();
        if (!/^[a-z0-9]{3,30}$/.test(cleanUserName)) {
          throw new BadRequestException(
            'Username must contain only lowercase letters and numbers (3-30 characters) with no special symbols',
          );
        }
        if (cleanUserName !== user.username) {
          const existing = await this.UserModel.findOne({ username: cleanUserName });
          if (existing && String(existing._id) !== String(user._id)) {
            throw new ConflictException('Username is already taken');
          }
          user.username = cleanUserName;
        }
      }

      if (dto.fullName !== undefined) user.fullName = dto.fullName;
      if (dto.institution !== undefined) user.institution = dto.institution;
      if (dto.bio !== undefined) user.bio = dto.bio;
      if (dto.profilePicture !== undefined) user.profilePicture = dto.profilePicture;
      if (dto.mobileNo !== undefined) user.mobileNo = dto.mobileNo;
      if (dto.address !== undefined) user.address = dto.address;
      if (dto.dateOfBirth !== undefined) user.dateOfBirth = dto.dateOfBirth;
      if (dto.xp !== undefined) user.xp = dto.xp;

      await user.save();
      return {
        message: 'User profile updated successfully',
        data: {
          updated: true,
          user: {
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            institution: user.institution,
            bio: user.bio,
            profilePicture: user.profilePicture,
            mobileNo: user.mobileNo,
            address: user.address,
            dateOfBirth: user.dateOfBirth,
            xp: user.xp || 0,
            settings: user.settings,
          },
        },
      };
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Error updating user profile');
    }
  }

  async updateSettings(
    email: string,
    dto: updateSettingsDto,
  ): Promise<ServiceResponse<any>> {
    try {
      const user = await this.UserModel.findOne({ email });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const defaultSettings = {
        starfieldMotion: true,
        highContrast: false,
        kioskAutoLock: true,
        liveArenaInvites: true,
        leaderboardSurgeAlerts: true,
        weeklyDigest: true,
      };

      user.settings = {
        ...(user.settings || defaultSettings),
        ...dto,
      };

      await user.save();
      return {
        message: 'Settings updated successfully',
        data: { settings: user.settings },
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error updating settings');
    }
  }

  async createSupportTicket(
    userId: string,
    email: string,
    dto: createSupportTicketDto,
  ): Promise<ServiceResponse<{ ticketId: string }>> {
    try {
      const ticketId = `TICK-${Math.floor(1000 + Math.random() * 9000)}-QC`;
      const user = await this.UserModel.findOne({
        $or: [{ email }, { _id: userId }],
      });

      const name = user?.fullName || user?.username || 'Pilot';

      await this.TicketModel.create({
        ticketId,
        userId: String(userId),
        email,
        name,
        category: dto.category,
        urgency: dto.urgency,
        subject: dto.subject,
        message: dto.message,
        status: 'OPEN',
      });

      // Dispatch confirmation email via MailService (resilient to mail server failures in dev)
      try {
        await this.mailService.sendSupportTicketEmail({
          ticketId,
          name,
          email,
          category: dto.category,
          urgency: dto.urgency,
          subject: dto.subject,
          message: dto.message,
        });
      } catch (mailError) {
        console.warn('Notice: Support email dispatch skipped or unavailable:', mailError);
      }

      return {
        message: 'Support ticket submitted successfully',
        data: { ticketId },
      };
    } catch (error) {
      console.error('Error in createSupportTicket:', error);
      throw new InternalServerErrorException('Error submitting support ticket');
    }
  }

  async GetQuizzesForProfile(
    email: string,
    userId?: string,
  ): Promise<ServiceResponse<{ quizzes: any[] }>> {
    try {
      const user = await this.UserModel.findOne({
        $or: [{ email }, ...(userId ? [{ _id: userId }] : [])],
      }).lean();

      const userEmails = [
        email,
        ...(Array.isArray(user?.emails) ? user.emails : []),
      ].filter(Boolean);

      const conditions: any[] = [
        { ownerEmail: { $in: userEmails } },
      ];
      if (userId) {
        conditions.push({ ownerId: String(userId) });
      }

      const quizzes = await this.QuizModel.find({
        $or: conditions,
      })
        .sort({ _id: -1 })
        .lean();

      // Aggregate total plays/attempts across user's quizzes
      const quizIds = quizzes.map((q) => q.quizId).filter(Boolean);
      const attemptCounts = await this.AttemptsModel.aggregate([
        { $match: { quizId: { $in: quizIds } } },
        { $group: { _id: '$quizId', count: { $sum: 1 } } },
      ]);
      const playsMap = new Map<string, number>();
      for (const item of attemptCounts) {
        playsMap.set(String(item._id), item.count);
      }

      const enrichedQuizzes = quizzes.map((quiz) => {
        const playsCount = playsMap.get(quiz.quizId) || 0;
        const topic = (quiz as any).topic || deriveTopic(quiz.title, quiz.questions);
        return {
          ...quiz,
          playsCount,
          topic,
        };
      });

      return {
        message: 'Quizzes found',
        data: { quizzes: enrichedQuizzes },
      };
    } catch (error) {
      console.error('Error in GetQuizzesForProfile:', error);
      throw new InternalServerErrorException('Error fetching quizzes');
    }
  }

  async GetHistory(
    userIdOrEmail: string,
  ): Promise<ServiceResponse<{ history: any[]; quizzes: any[] }>> {
    try {
      const user = await this.UserModel.findOne({
        $or: [{ email: userIdOrEmail }, { username: userIdOrEmail }],
      });
      const userId = user ? (user as any)._id?.toString() : userIdOrEmail;

      const attempts = await this.AttemptsModel.find({
        $or: [
          { userId: userIdOrEmail },
          { userId: String(userId) },
          ...(user?.email ? [{ userId: user.email }] : []),
        ],
      })
        .sort({ lastUpdateAt: -1, createdAt: -1 })
        .lean();

      const quizIds = Array.from(new Set(attempts.map((a) => a.quizId).filter(Boolean)));
      const quizzes = await this.QuizModel.find({ quizId: { $in: quizIds } }).lean();
      const quizMap = new Map(quizzes.map((q) => [q.quizId, q]));

      // Query all attempts across these quizzes to calculate real competitive rankings
      const allAttemptsForQuizzes = await this.AttemptsModel.find({
        quizId: { $in: quizIds },
      })
        .select('quizId sessionId userId score accuracy totalTimeSpentSeconds createdAt lastUpdateAt isActive')
        .lean();

      // Group attempts by quizId and rank by score (desc), duration (asc), createdAt (asc)
      const attemptsByQuiz = new Map<string, any[]>();
      for (const att of allAttemptsForQuizzes) {
        const list = attemptsByQuiz.get(att.quizId) || [];
        list.push(att);
        attemptsByQuiz.set(att.quizId, list);
      }

      for (const [, list] of attemptsByQuiz.entries()) {
        list.sort((a, b) => {
          const scoreDiff = (Number(b.score) || 0) - (Number(a.score) || 0);
          if (scoreDiff !== 0) return scoreDiff;
          const timeA = typeof a.totalTimeSpentSeconds === 'number' && a.totalTimeSpentSeconds > 0 ? a.totalTimeSpentSeconds : 999999;
          const timeB = typeof b.totalTimeSpentSeconds === 'number' && b.totalTimeSpentSeconds > 0 ? b.totalTimeSpentSeconds : 999999;
          if (timeA !== timeB) return timeA - timeB;
          const dateA = new Date(a.createdAt || a.lastUpdateAt || 0).getTime();
          const dateB = new Date(b.createdAt || b.lastUpdateAt || 0).getTime();
          return dateA - dateB;
        });
      }

      const enrichedHistory = attempts.map((attempt) => {
        const matchingQuiz = quizMap.get(attempt.quizId);
        const totalQuestions = matchingQuiz?.questions?.length || attempt.Responses?.length || 10;
        const scoreVal = typeof attempt.score === 'number' ? attempt.score : 0;
        const scorePct = totalQuestions > 0 ? `${Math.round((scoreVal / totalQuestions) * 100)}%` : '0%';
        const correctAnswers = `${scoreVal}/${totalQuestions}`;

        // Compute session code from real sessionId
        const sessionCode = attempt.sessionId
          ? `SES-${attempt.sessionId.slice(0, 8).toUpperCase()}`
          : `SES-${String((attempt as any)._id).slice(-8).toUpperCase()}`;

        // Compute real total duration
        let seconds = typeof attempt.totalTimeSpentSeconds === 'number' ? attempt.totalTimeSpentSeconds : 0;
        if (!seconds && Array.isArray(attempt.Responses)) {
          seconds = attempt.Responses.reduce(
            (sum: number, r: any) => sum + (Number(r?.timeSpentSeconds) || 0),
            0,
          );
        }
        if (!seconds && attempt.startedAt && attempt.lastUpdateAt) {
          const diff = Math.round(
            (new Date(attempt.lastUpdateAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000,
          );
          if (diff > 0) seconds = diff;
        }

        let timeSpent = 'Active Session';
        if (attempt.isActive) {
          timeSpent = 'In Progress';
        } else if (seconds > 0) {
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          if (mins > 0) {
            timeSpent = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
          } else {
            timeSpent = `${secs}s`;
          }
        } else {
          timeSpent = '< 1m';
        }

        // Compute real XP earned from question answers
        let xpEarned = 0;
        const questions = matchingQuiz?.questions || [];
        if (questions.length > 0 && Array.isArray(attempt.Responses) && attempt.Responses.length > 0) {
          for (const resp of attempt.Responses) {
            const q = questions.find((item) => item.questionId === resp.questionId);
            if (q && resp.chosenOption?.[0]) {
              if (checkIsCorrect(resp.chosenOption[0], q.answer, q.options)) {
                xpEarned += Number(q.xp) || (q.level === 'EASY' ? 100 : q.level === 'HARD' ? 300 : 200);
              }
            }
          }
        }
        if (xpEarned === 0 && scoreVal > 0) {
          xpEarned = scoreVal * 200;
        }

        // Compute real rank among attempts
        let rank = 'Evaluated';
        let rankNumber = 1;
        let totalParticipants = 1;
        if (attempt.isActive) {
          rank = 'In Progress';
        } else {
          const quizList = attemptsByQuiz.get(attempt.quizId) || [];
          totalParticipants = quizList.length || 1;
          const foundIdx = quizList.findIndex((item) => item.sessionId === attempt.sessionId);
          rankNumber = foundIdx >= 0 ? foundIdx + 1 : 1;
          if (totalParticipants > 1) {
            rank = `#${rankNumber} of ${totalParticipants}`;
          } else {
            rank = `#1 of 1 (Solo)`;
          }
        }

        const status = attempt.isActive
          ? 'IN PROGRESS'
          : scoreVal / totalQuestions >= 0.8
          ? 'EXCELLENT'
          : 'COMPLETED';

        return {
          ...attempt,
          title: matchingQuiz?.title || 'Interactive Arena Challenge',
          totalQuestions,
          score: scoreVal,
          scorePct,
          correctAnswers,
          sessionCode,
          totalTimeSpentSeconds: seconds,
          timeSpent,
          xpEarned,
          rank,
          rankNumber,
          totalParticipants,
          status,
        };
      });

      return {
        message: 'History found',
        data: {
          history: enrichedHistory,
          quizzes: enrichedHistory,
        },
      };
    } catch (error) {
      console.error('Error in GetHistory:', error);
      throw new InternalServerErrorException('Error fetching history');
    }
  }

  async linkEmail(
    userId: string,
    rawEmail: string,
  ): Promise<ServiceResponse<{ email: string; emails: string[] }>> {
    const emailToLink = (rawEmail || '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToLink)) {
      throw new BadRequestException('Invalid email address format');
    }

    const existingUser = await this.UserModel.findOne({
      $or: [{ email: emailToLink }, { emails: emailToLink }],
    });

    if (existingUser && String(existingUser._id) !== String(userId)) {
      throw new ConflictException('This email is already associated with another account');
    }

    const user = await this.UserModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const currentEmails = Array.isArray(user.emails) && user.emails.length > 0
      ? user.emails
      : [user.email];

    if (!currentEmails.includes(emailToLink)) {
      currentEmails.push(emailToLink);
      user.emails = currentEmails;
      await user.save();
    }

    return {
      message: 'Email linked successfully',
      data: {
        email: user.email,
        emails: user.emails,
      },
    };
  }

  async unlinkEmail(
    userId: string,
    rawEmail: string,
  ): Promise<ServiceResponse<{ email: string; emails: string[] }>> {
    const emailToRemove = (rawEmail || '').toLowerCase().trim();
    const user = await this.UserModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.email === emailToRemove) {
      throw new BadRequestException('Cannot unlink primary account email');
    }

    const currentEmails = Array.isArray(user.emails) && user.emails.length > 0
      ? user.emails
      : [user.email];

    user.emails = currentEmails.filter((e) => e !== emailToRemove);
    await user.save();

    return {
      message: 'Email unlinked successfully',
      data: {
        email: user.email,
        emails: user.emails,
      },
    };
  }
}

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

      return {
        message: 'Quizzes found',
        data: { quizzes },
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
        ],
      })
        .sort({ lastUpdateAt: -1 })
        .lean();

      const quizIds = attempts.map((a) => a.quizId).filter(Boolean);
      const quizzes = await this.QuizModel.find({ quizId: { $in: quizIds } }).lean();
      const quizMap = new Map(quizzes.map((q) => [q.quizId, q]));

      const enrichedHistory = attempts.map((attempt) => {
        const matchingQuiz = quizMap.get(attempt.quizId);
        return {
          ...attempt,
          title: matchingQuiz?.title || 'Interactive Arena Challenge',
          totalQuestions: matchingQuiz?.questions?.length || attempt.Responses?.length || 10,
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

import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  RegisterAuthDto,
  LoginAuthDto,
  LogoutAuthDto,
  MeAuthDto,
  RefreshAuthDto,
  VerifyOTPAuthDto,
  SendPasswordResetMailAuthDto,
  ResetPasswordAuthDto,
  ResendOTP,
} from './dto/auth.request.dto';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';
import { comparePassword, hashPassword } from '../common/utils/hash.util';
import { generateToken, verifyToken } from '../common/utils/token.util';
import { ConfigService } from '@nestjs/config';
import { ServiceResponse } from '../common/interfaces/service-response.interface';
import type {
  RegisterResponseData,
  LoginResponseData,
  MeResponseData,
  RefreshAuthData,
} from './interfaces/auth-response.interface';
import {
  toLoginDto,
  toRegisterDto,
  toMeDto,
} from './mapper/auth-response.mapper';
import { TokenPayload } from './interfaces/TokenPayload.interface';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @Inject('USER_MODEL') private UserModel: Model<User>,
    @Inject('ORGANIZATION_MODEL') private OrgModel: Model<any>,
    @Inject('GROUP_MODEL') private GroupModel: Model<any>,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit() {
    try {
      const indexes = await this.UserModel.collection.indexes();
      if (indexes.some((i) => i.name === 'mobileNo_1')) {
        await this.UserModel.collection.dropIndex('mobileNo_1');
        console.log('[AuthService] Successfully dropped obsolete mobileNo_1 index.');
      }
    } catch {
      // Index already dropped or not present
    }
  }

  private getSalt(): number {
    return Number(this.configService.get<number>('SALT'));
  }
  private async generateAuthTokens(
    userId: string,
    email: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    hashedRefreshToken: string;
  }> {
    const accessTokenPayload = { userId, email };
    const refreshTokenPayload = { userId, email };

    const accessToken = generateToken(
      accessTokenPayload,
      this.configService.get<string>('JWT_ACCESS_SECRET')!,
      this.configService.get<string>('JWT_ACCESS_EXPIRY')!,
    );

    const refreshToken = generateToken(
      refreshTokenPayload,
      this.configService.get<string>('JWT_REFRESH_SECRET')!,
      this.configService.get<string>('JWT_REFRESH_EXPIRY')!,
    );

    const hashedRefreshToken = await hashPassword(refreshToken, this.getSalt());
    return {
      accessToken,
      refreshToken,
      hashedRefreshToken,
    };
  }

  async me(dto: MeAuthDto): Promise<ServiceResponse<MeResponseData>> {
    const user = await this.UserModel.findById(dto.userId);
    if (!user) throw new UnauthorizedException('Invalid session');

    if (user.orgId && !user.orgSlug) {
      const org = await this.OrgModel.findOne({ orgId: user.orgId }).select('slug').lean();
      if (org) {
        user.orgSlug = org.slug;
        await user.save().catch(() => {});
      }
    }

    return {
      message: 'User found',
      data: {
        user: toMeDto(user),
      },
    };
  }

  async checkUsernameAvailability(
    rawUsername: string,
  ): Promise<ServiceResponse<{ available: boolean; valid: boolean; message: string }>> {
    const username = (rawUsername || '').toLowerCase().trim();
    if (!/^[a-z0-9]{3,30}$/.test(username)) {
      return {
        message: 'Invalid username format',
        data: {
          available: false,
          valid: false,
          message: 'Username must be 3-30 lowercase alphanumeric characters with no special symbols',
        },
      };
    }

    const existingUser = await this.UserModel.findOne({ username });
    if (existingUser) {
      return {
        message: 'Username is taken',
        data: {
          available: false,
          valid: true,
          message: 'Username is already taken',
        },
      };
    }

    return {
      message: 'Username is available',
      data: {
        available: true,
        valid: true,
        message: 'Username is available',
      },
    };
  }

  async register(
    dto: RegisterAuthDto,
  ): Promise<ServiceResponse<RegisterResponseData>> {
    const username = (dto.username || '').toLowerCase().trim();
    if (!/^[a-z0-9]{3,30}$/.test(username)) {
      throw new BadRequestException(
        'Username must contain only lowercase letters and numbers (3-30 characters) with no special symbols',
      );
    }
    const existingUsername = await this.UserModel.findOne({ username });
    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }
    dto.username = username;

    const normalizedEmail = (dto.email || '').toLowerCase().trim();
    const existingEmail = await this.UserModel.findOne({
      $or: [{ email: normalizedEmail }, { emails: normalizedEmail }],
    });
    if (existingEmail) {
      throw new ConflictException('An account with this email already exists');
    }
    dto.email = normalizedEmail;

    const hashedPassword = await hashPassword(dto.password, this.getSalt());

    const rawPhone = (dto.phoneNumber || '').trim();
    const parsedMobileNo = rawPhone
      ? Number(rawPhone.replace(/\D/g, '')) || undefined
      : dto.mobileNo || undefined;

    let resolvedOrgId: string | null = null;
    let resolvedOrgSlug: string | null = null;
    let initialRole: 'PUBLIC_USER' | 'ORG_STD' = 'PUBLIC_USER';
    const initialGroupIds: string[] = [];

    if (dto.orgId) {
      const orgQuery = dto.orgId.trim();
      const org = await this.OrgModel.findOne({
        $or: [{ orgId: orgQuery }, { slug: orgQuery.toLowerCase() }],
      });
      if (org) {
        resolvedOrgId = org.orgId;
        resolvedOrgSlug = org.slug;
        initialRole = 'ORG_STD';
      }
    }

    if (dto.groupCode) {
      const codeQuery = dto.groupCode.trim().toUpperCase();
      const group = await this.GroupModel.findOne({ code: codeQuery });
      if (group) {
        if (!resolvedOrgId) {
          resolvedOrgId = group.orgId;
          const parentOrg = await this.OrgModel.findOne({ orgId: group.orgId });
          if (parentOrg) resolvedOrgSlug = parentOrg.slug;
          initialRole = 'ORG_STD';
        }
        if (!group.isLocked && !group.requireApproval) {
          initialGroupIds.push(group.groupId);
        }
      }
    }

    try {
      const OTP = Math.floor(100000 + Math.random() * 900000).toString();
      const userPayload: any = {
        ...dto,
        fullName: dto.fullName?.trim() || '',
        institution: dto.institution?.trim() || '',
        phoneNumber: rawPhone,
        email: normalizedEmail,
        emails: [normalizedEmail],
        password: hashedPassword,
        role: initialRole,
        orgId: resolvedOrgId,
        orgSlug: resolvedOrgSlug,
        groupIds: initialGroupIds,
      };

      if (parsedMobileNo !== undefined) {
        userPayload.mobileNo = parsedMobileNo;
      } else {
        delete userPayload.mobileNo;
      }

      const createdUser = await this.UserModel.create(userPayload);

      if (initialGroupIds.length > 0 && dto.groupCode) {
        await this.GroupModel.updateOne(
          { code: dto.groupCode.trim().toUpperCase() },
          { $addToSet: { memberIds: String(createdUser._id) } },
        );
      }
      const hashedOTP = await hashPassword(OTP, this.getSalt());
      const cacheKey = `reg-otp-${createdUser.email}`;
      await this.redisService.set(cacheKey, hashedOTP, 1000 * 60 * 2);

      await createdUser.save();
      await this.mailService.sendVerificationEmail(dto.email, OTP);
      return {
        message: 'otp sent successfully',
        data: { user: toRegisterDto(createdUser) },
      };
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException(error.errorResponse);
      }
      throw new InternalServerErrorException(
        error.message || 'An unexpected error occurred',
      );
    }
  }

  async login(dto: LoginAuthDto): Promise<ServiceResponse<LoginResponseData>> {
    const normalizedEmail = (dto.email || '').toLowerCase().trim();
    const user = await this.UserModel.findOne({
      $or: [{ email: normalizedEmail }, { emails: normalizedEmail }],
    });
    if (!user) throw new NotFoundException('User not found');

    const isMatch = await comparePassword(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException();

    // Ensure user has emails array populated
    if (!user.emails || user.emails.length === 0) {
      user.emails = [user.email];
    }

    if (user.orgId && !user.orgSlug) {
      const org = await this.OrgModel.findOne({ orgId: user.orgId }).select('slug').lean();
      if (org) {
        user.orgSlug = org.slug;
      }
    }

    // Auto-join organization on login if requested via invite / portal route
    const targetOrgIdentifier = (dto.orgSlug || dto.orgId || '').toLowerCase().trim();
    if (targetOrgIdentifier) {
      const targetOrg = await this.OrgModel.findOne({
        $or: [{ slug: targetOrgIdentifier }, { orgId: targetOrgIdentifier }],
      });
      if (targetOrg && targetOrg.status === 'ACTIVE') {
        const memberCount = await this.UserModel.countDocuments({ orgId: targetOrg.orgId });
        const seatsAvailable = memberCount < targetOrg.maxSeats;

        let domainMatches = true;
        if (targetOrg.allowedEmailDomain) {
          const domain = targetOrg.allowedEmailDomain.toLowerCase().replace(/^@/, '').trim();
          const allUserEmails = [user.email, ...(user.emails || [])].map((e) => e.toLowerCase().trim());
          domainMatches = allUserEmails.some((e) => e.endsWith(`@${domain}`));
        }

        if (seatsAvailable && domainMatches) {
          user.orgId = targetOrg.orgId;
          user.orgSlug = targetOrg.slug;
          if (!user.role || user.role === 'PUBLIC_USER') {
            user.role = 'ORG_STD';
          }
          user.institution = targetOrg.name;
        }
      }
    }

    const { accessToken, refreshToken, hashedRefreshToken } =
      await this.generateAuthTokens(String(user._id), user.email);

    user.refreshToken = hashedRefreshToken;
    await user.save();

    return {
      message: 'Login successful',
      data: {
        user: toLoginDto(user),
        accessToken,
        refreshToken,
      },
    };
  }

  async logout(dto: LogoutAuthDto): Promise<ServiceResponse<boolean>> {
    const user = await this.UserModel.findOne(
      { _id: dto.userId },
      { refreshToken: 1 },
    );
    if (!user) throw new NotFoundException('User not found');

    user.refreshToken = '';
    await user.save();

    return {
      message: 'Logout successful',
      data: true,
    };
  }

  async ResendRegisterOTP(dto: ResendOTP): Promise<ServiceResponse<boolean>> {
    const { email } = dto;
    try {
      const user = await this.UserModel.findOne({ email: email });
      if (!user) throw new NotFoundException('User Does not exist');
      const OTP = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOTP = await hashPassword(OTP, this.getSalt());
      const cacheKey = `reg-otp-${email}`;
      await this.redisService.set(cacheKey, hashedOTP, 1000 * 60 * 2);
      await this.mailService.sendVerificationEmail(email, OTP);
      return {
        message: 'otp sent successfully',
        data: true,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        error.message || 'Unexpected error occurred',
      );
    }
  }

  async refresh(
    dto: RefreshAuthDto,
  ): Promise<ServiceResponse<RefreshAuthData>> {
    const REFRESH_SECRET =
      this.configService.get<string>('JWT_REFRESH_SECRET')!;
    let tokenInfo: TokenPayload;
    try {
      tokenInfo = verifyToken(dto.refreshToken, REFRESH_SECRET) as TokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const { userId } = tokenInfo;
    const user = await this.UserModel.findById(userId).select(
      '_id email refreshToken',
    );
    if (!user) throw new UnauthorizedException('Invalid session');
    if (!user.refreshToken)
      throw new UnauthorizedException('Already logged out or invalid session');

    const isTokenMatching = await comparePassword(
      dto.refreshToken,
      user.refreshToken,
    );
    if (!isTokenMatching) throw new UnauthorizedException('Invalid token');

    const { accessToken, refreshToken, hashedRefreshToken } =
      await this.generateAuthTokens(String(user._id), user.email);
    user.refreshToken = hashedRefreshToken;
    await user.save();

    return {
      message: 'Tokens refreshed successfully',
      data: { accessToken, refreshToken },
    };
  }

  async verifyRegistrationOTP(
    dto: VerifyOTPAuthDto,
  ): Promise<ServiceResponse<LoginResponseData>> {
    const { email, OTP } = dto;
    try {
      const cacheKey = `reg-otp-${email}`;
      const hashedOTP = await this.redisService.get(cacheKey);
      if (!hashedOTP)
        throw new UnauthorizedException('No OTP found for this user');
      const user = await this.UserModel.findOne({ email });
      if (!user) throw new NotFoundException('User not found');
      if (user.verified) throw new ConflictException('User already verified');
      const isMatch = await comparePassword(OTP, String(hashedOTP));
      if (!isMatch) throw new UnauthorizedException('Invalid OTP');

      const { accessToken, refreshToken, hashedRefreshToken } =
        await this.generateAuthTokens(String(user._id), user.email);
      user.verified = true;
      user.refreshToken = hashedRefreshToken;
      await user.save();

      return {
        message: 'User Verified Successfully',
        data: {
          user: toLoginDto(user),
          accessToken,
          refreshToken,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        error.message || 'An unexpected error occurred',
      );
    }
  }

  async sendPasswordResetMail(
    dto: SendPasswordResetMailAuthDto,
  ): Promise<ServiceResponse<{ sent: boolean }>> {
    const { email } = dto;
    const user = await this.UserModel.findOne({ email });
    if (!user) throw new NotFoundException('User not found');
    if (user.verified === false)
      throw new UnauthorizedException('User not verified');
    const OTP = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = await hashPassword(OTP, this.getSalt());
    const cacheKey = `pas-otp-${email}`;
    await this.redisService.set(cacheKey, hashedOTP, 1000 * 60 * 2);
    this.mailService.sendPasswordResetEmail(email, OTP);
    return {
      message: 'otp sent successfully',
      data: { sent: true },
    };
  }

  async ResendPasswordResetOTP(
    dto: ResendOTP,
  ): Promise<ServiceResponse<boolean>> {
    const { email } = dto;
    try {
      const user = await this.UserModel.findOne({ email: email });
      if (!user) throw new NotFoundException('User Does not exist');
      const OTP = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOTP = await hashPassword(OTP, this.getSalt());
      const cacheKey = `pas-otp-${email}`;
      await this.redisService.set(cacheKey, hashedOTP, 1000 * 60 * 2);
      await this.mailService.sendPasswordResetEmail(email, OTP);
      return {
        message: 'otp sent successfully',
        data: true,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        error.message || 'Unexpected error occurred',
      );
    }
  }

  async verifyPasswordResetOTP(
    dto: VerifyOTPAuthDto,
  ): Promise<ServiceResponse<{ verified: boolean; RESET_PASS_TOKEN: string }>> {
    const { email, OTP } = dto;
    try {
      const cacheKey = `pas-otp-${email}`;
      const hashedOTP = await this.redisService.get(cacheKey);
      if (!hashedOTP)
        throw new UnauthorizedException('No OTP found for this user ');
      const user = await this.UserModel.findOne({ email });
      if (!user) throw new NotFoundException('User not found');
      if (!user.verified) throw new ConflictException('User not verified');
      const isMatch = await comparePassword(OTP, String(hashedOTP));
      if (!isMatch) throw new UnauthorizedException('Invalid OTP');
      const RESET_PASS_TOKEN = generateToken(
        { userId: String(user._id), email: user.email },
        this.configService.get<string>('JWT_RESET_PASS_SECRET')!,
        this.configService.get<string>('JWT_RESET_PASS_EXPIRY')!,
      );
      return {
        message: 'OTP verified successfully',
        data: {
          verified: true,
          RESET_PASS_TOKEN: RESET_PASS_TOKEN,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        error.message || 'An unexpected error occurred',
      );
    }
  }
  async ResetPassword(
    dto: ResetPasswordAuthDto,
  ): Promise<ServiceResponse<{ reset: boolean }>> {
    const { email, password } = dto;
    const user = await this.UserModel.findOne({ email });
    if (!user) throw new NotFoundException('User not found');
    const hashedPassword = await hashPassword(password, this.getSalt());
    user.password = hashedPassword;
    await user.save();
    return {
      message: 'Password reset successful',
      data: { reset: true },
    };
  }
}

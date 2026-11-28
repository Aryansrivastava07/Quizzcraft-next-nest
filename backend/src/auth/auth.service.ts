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
  GoogleAuthDto,
} from './dto/auth.request.dto';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';
import { GOOGLE_STATE_TTL_MS, GoogleOAuthState, GoogleSignInContext } from '../schemas/google-oauth-state.schema';
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
    @Inject('GOOGLE_OAUTH_STATE_MODEL') private readonly googleStates: Model<GoogleOAuthState>,
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

  private getGoogleOAuth2Client(customCallbackUrl?: string): OAuth2Client {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend .env',
      );
    }

    const callbackUrl =
      this.configService.get<string>('GOOGLE_CALLBACK_URL') ||
      customCallbackUrl ||
      'http://localhost:5000/auth/google/callback';

    return new OAuth2Client(clientId, clientSecret, callbackUrl);
  }

  async getGoogleAuthUrl(
    params: GoogleSignInContext,
    reqCallbackUrl?: string,
  ) {
    const client = this.getGoogleOAuth2Client(reqCallbackUrl);
    const state = crypto.randomBytes(32).toString('hex');
    const browserToken = crypto.randomBytes(32).toString('hex');
    await this.googleStates.create({
      ...params,
      _id: state,
      browserHash: crypto.createHash('sha256').update(browserToken).digest('hex'),
      expiresAt: new Date(Date.now() + GOOGLE_STATE_TTL_MS),
    });

    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'openid',
      ],
      prompt: 'select_account',
      state,
    });
    return { authUrl, state, browserToken };
  }

  async consumeGoogleState(state: unknown, browserToken: unknown): Promise<GoogleSignInContext> {
    const invalidState = 'Google sign-in expired or could not be verified. Please start again.';
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state) ||
        typeof browserToken !== 'string' || !/^[a-f0-9]{64}$/.test(browserToken)) {
      throw new BadRequestException(invalidState);
    }
    const transaction = await this.googleStates.findOneAndDelete({
      _id: state,
      browserHash: crypto.createHash('sha256').update(browserToken).digest('hex'),
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!transaction) throw new BadRequestException(invalidState);
    return transaction;
  }

  async handleGoogleCallback(
    code: string,
    stateData: GoogleSignInContext,
    reqCallbackUrl?: string,
  ): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
    redirect: string;
  }> {
    if (!code) {
      throw new BadRequestException('Authorization code from Google is missing');
    }

    const client = this.getGoogleOAuth2Client(reqCallbackUrl);
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    if (!tokens.id_token) {
      throw new UnauthorizedException('Google failed to provide an ID token');
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedException('Failed to retrieve verified email from Google');
    }

    const result = await this.validateOrCreateGoogleUser({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      orgId: stateData.org,
      orgSlug: stateData.org,
      groupCode: stateData.group,
    });

    return {
      ...result,
      redirect: stateData.redirect || '/profile',
    };
  }

  async handleGoogleTokenLogin(
    dto: GoogleAuthDto,
  ): Promise<ServiceResponse<LoginResponseData>> {
    const tokenToVerify = dto.idToken || dto.credential;
    if (!tokenToVerify) {
      throw new BadRequestException('No Google idToken or credential provided');
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const client = this.getGoogleOAuth2Client();

    const ticket = await client.verifyIdToken({
      idToken: tokenToVerify,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedException('Failed to retrieve verified email from Google');
    }

    const { user, accessToken, refreshToken } = await this.validateOrCreateGoogleUser({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      orgId: dto.orgId,
      orgSlug: dto.orgSlug,
      groupCode: dto.groupCode,
    });

    return {
      message: 'Google authentication successful',
      data: {
        user: toLoginDto(user),
        accessToken,
        refreshToken,
      },
    };
  }

  private async validateOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    name?: string;
    picture?: string;
    orgId?: string;
    orgSlug?: string;
    groupCode?: string;
  }): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const normalizedEmail = (profile.email || '').toLowerCase().trim();

    let user = await this.UserModel.findOne({
      $or: [
        { googleId: profile.googleId },
        { email: normalizedEmail },
        { emails: normalizedEmail },
      ],
    });

    if (user) {
      // Existing user update
      if (!user.googleId) {
        user.googleId = profile.googleId;
      }
      user.verified = true;
      if (!user.profilePicture && profile.picture) {
        user.profilePicture = profile.picture;
      }
      if (!user.fullName && profile.name) {
        user.fullName = profile.name;
      }
      if (!user.emails || user.emails.length === 0) {
        user.emails = [user.email];
      }
      if (!user.emails.includes(normalizedEmail)) {
        user.emails.push(normalizedEmail);
      }

      // Check organization auto-enrollment
      const targetOrgIdentifier = (profile.orgSlug || profile.orgId || '').toLowerCase().trim();
      if (targetOrgIdentifier && (!user.orgId || user.role === 'PUBLIC_USER')) {
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
            user.role = 'ORG_STD';
            user.institution = targetOrg.name;
          }
        }
      }

      // Check group auto-enrollment
      if (profile.groupCode) {
        const group = await this.GroupModel.findOne({ code: profile.groupCode.trim().toUpperCase() });
        if (group && !group.isLocked && !group.requireApproval) {
          if (!user.groupIds) user.groupIds = [];
          if (!user.groupIds.includes(group.groupId)) {
            user.groupIds.push(group.groupId);
            await this.GroupModel.updateOne(
              { code: profile.groupCode.trim().toUpperCase() },
              { $addToSet: { memberIds: String(user._id) } },
            );
          }
        }
      }
    } else {
      // New user registration via Google
      let baseUsername = (profile.name || normalizedEmail.split('@')[0] || 'cadet')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 20);
      if (baseUsername.length < 3) baseUsername = 'cadet';

      let uniqueUsername = baseUsername;
      let attempts = 0;
      while (attempts < 10) {
        const existing = await this.UserModel.findOne({ username: uniqueUsername });
        if (!existing) break;
        uniqueUsername = `${baseUsername.slice(0, 16)}${Math.floor(1000 + Math.random() * 9000)}`;
        attempts++;
      }

      let resolvedOrgId: string | null = null;
      let resolvedOrgSlug: string | null = null;
      let resolvedInstitution = '';
      let initialRole: 'PUBLIC_USER' | 'ORG_STD' = 'PUBLIC_USER';
      const initialGroupIds: string[] = [];

      if (profile.orgId || profile.orgSlug) {
        const orgQuery = (profile.orgSlug || profile.orgId)!.trim();
        const org = await this.OrgModel.findOne({
          $or: [{ orgId: orgQuery }, { slug: orgQuery.toLowerCase() }],
        });
        if (org && org.status === 'ACTIVE') {
          resolvedOrgId = org.orgId;
          resolvedOrgSlug = org.slug;
          resolvedInstitution = org.name;
          initialRole = 'ORG_STD';
        }
      }

      if (profile.groupCode) {
        const codeQuery = profile.groupCode.trim().toUpperCase();
        const group = await this.GroupModel.findOne({ code: codeQuery });
        if (group) {
          if (!resolvedOrgId) {
            resolvedOrgId = group.orgId;
            const parentOrg = await this.OrgModel.findOne({ orgId: group.orgId });
            if (parentOrg) {
              resolvedOrgSlug = parentOrg.slug;
              resolvedInstitution = parentOrg.name;
            }
            initialRole = 'ORG_STD';
          }
          if (!group.isLocked && !group.requireApproval) {
            initialGroupIds.push(group.groupId);
          }
        }
      }

      const randomPassword = await hashPassword(crypto.randomUUID(), this.getSalt());

      user = await this.UserModel.create({
        username: uniqueUsername,
        email: normalizedEmail,
        emails: [normalizedEmail],
        fullName: profile.name?.trim() || '',
        profilePicture: profile.picture || '',
        googleId: profile.googleId,
        verified: true,
        password: randomPassword,
        role: initialRole,
        orgId: resolvedOrgId,
        orgSlug: resolvedOrgSlug,
        institution: resolvedInstitution,
        groupIds: initialGroupIds,
      });

      if (initialGroupIds.length > 0 && profile.groupCode) {
        await this.GroupModel.updateOne(
          { code: profile.groupCode.trim().toUpperCase() },
          { $addToSet: { memberIds: String(user._id) } },
        );
      }
    }

    const { accessToken, refreshToken, hashedRefreshToken } =
      await this.generateAuthTokens(String(user._id), user.email);

    user.refreshToken = hashedRefreshToken;
    await user.save();

    return { user, accessToken, refreshToken };
  }
}

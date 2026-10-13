import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  Res,
  Req,
  UseGuards,
  HttpCode,
  UnauthorizedException,
  Get,
  Query,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterAuthDto, LoginAuthDto, LogoutAuthDto, VerifyOTPAuthDto, SendPasswordResetMailAuthDto, ResetPasswordAuthDto, ResendOTP, GoogleAuthDto } from './dto/auth.request.dto';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { SanitizeInterceptor } from '../common/interceptors/sanitize.interceptor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ResetPassGuard } from '../common/guards/reset-pass.guard';

@Controller('auth')
@UseInterceptors(LoggingInterceptor, SanitizeInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  private getCookieOptions(req: any, maxAge: number) {
    const isProd = process.env.NODE_ENV === 'production';
    const isHttps = req?.secure || req?.headers?.['x-forwarded-proto'] === 'https';
    const isSecure = isProd || isHttps;
    return {
      httpOnly: true,
      secure: isSecure,
      sameSite: (isSecure ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
      maxAge,
    };
  }

  @HttpCode(200)
  @Get('check-username')
  checkUsername(@Query('username') username: string) {
    return this.authService.checkUsernameAvailability(username);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Get('me')
  Me(@Req() req) {
    const userId = req.user.userId;
    return this.authService.me({ userId });
  }

  @HttpCode(201)
  @Post('register')
  register(@Body() dto: RegisterAuthDto) {
    return this.authService.register(dto);
  }

  @HttpCode(200)
  @Post('login')
  async login(
    @Req() req,
    @Body() loginAuthDto: LoginAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginAuthDto);
    const { accessToken, refreshToken, ...res } = result.data;

    response.cookie('accessToken', accessToken, this.getCookieOptions(req, 1000 * 60 * 10));
    response.cookie('refreshToken', refreshToken, this.getCookieOptions(req, 1000 * 60 * 60 * 24 * 10));

    return {
      message: result.message,
      data: {
        ...res,
        accessToken,
        refreshToken,
      }
    };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req, @Res({ passthrough: true }) response: Response) {
    const refreshToken = req.cookies?.refreshToken;
    const userId = req.user.userId;

    const res = await this.authService.logout({ userId, refreshToken });
    if (!res.data) throw new UnauthorizedException('Logout failed');

    response.clearCookie('accessToken', { path: '/' });
    response.clearCookie('refreshToken', { path: '/' });

    return res;
  }

  @HttpCode(200)
  @Post('refresh')
  async Refresh(@Req() req, @Res({ passthrough: true }) response: Response) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }
    const result = await this.authService.refresh({ refreshToken });
    const { accessToken, refreshToken: newRefreshToken, ...res } = result.data;

    response.cookie('accessToken', accessToken, this.getCookieOptions(req, 1000 * 60 * 10));
    response.cookie('refreshToken', newRefreshToken, this.getCookieOptions(req, 1000 * 60 * 60 * 24 * 10));

    return {
      message: result.message,
      data: {
        ...res,
        accessToken,
        refreshToken: newRefreshToken,
      }
    };
  }

  @HttpCode(200)
  @Post('resend-register-otp')
  async ResendRegisterOTP(@Body() dto: ResendOTP){
    return this.authService.ResendRegisterOTP(dto);
  }

  @HttpCode(200)
  @Post('verify-register-otp')
  async verifyRegsitrationOTP(
    @Req() req,
    @Body() dto: VerifyOTPAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyRegistrationOTP(dto);
    const { accessToken, refreshToken, ...res } = result.data;

    response.cookie('accessToken', accessToken, this.getCookieOptions(req, 1000 * 60 * 10));
    response.cookie('refreshToken', refreshToken, this.getCookieOptions(req, 1000 * 60 * 60 * 24 * 10));

    return {
      message: result.message,
      data: {
        ...res,
        accessToken,
        refreshToken,
      }
    };
  }

  @HttpCode(200)
  @Post('send-password-reset-mail')
  sendPasswordResetMail(@Body() dto: SendPasswordResetMailAuthDto) {
    return this.authService.sendPasswordResetMail(dto);
  }

  @HttpCode(200)
  @Post('resend-password-reset-otp')
  resendPasswordResetOTP(@Body() dto: ResendOTP) {
    return this.authService.ResendPasswordResetOTP(dto);
  }

  @HttpCode(200)
  @Post('verify-password-reset-otp')
  async verifyPasswordResetOTP(
    @Req() req,
    @Body() dto: VerifyOTPAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyPasswordResetOTP(dto);
    const { RESET_PASS_TOKEN, ...res } = result.data;

    response.cookie('RESET_PASS_TOKEN', RESET_PASS_TOKEN, this.getCookieOptions(req, 1000 * 60 * 10));

    return {
      message: result.message,
      data: {
        ...res,
        RESET_PASS_TOKEN,
      }
    };
  }

  @UseGuards(ResetPassGuard)
  @HttpCode(200)
  @Post('reset-password')
  ResetPassword(@Body() dto: ResetPasswordAuthDto, @Res({ passthrough: true }) response: Response) {
    response.clearCookie('RESET_PASS_TOKEN', { path: '/' });
    return this.authService.ResetPassword(dto);
  }

  @Get('google')
  googleAuth(
    @Req() req: any,
    @Res() response: Response,
    @Query('redirect') redirect?: string,
    @Query('org') org?: string,
    @Query('group') group?: string,
  ) {
    try {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const customCallbackUrl = `${protocol}://${host}/auth/google/callback`;

      const authUrl = this.authService.getGoogleAuthUrl(
        { redirect, org, group },
        customCallbackUrl,
      );
      return response.redirect(authUrl);
    } catch (err: any) {
      const frontendUrl =
        process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
      const errorMsg = encodeURIComponent(
        err.message || 'Google OAuth is not configured on the server.',
      );
      return response.redirect(`${frontendUrl}/auth?error=${errorMsg}`);
    }
  }

  @Get('google/callback')
  async googleCallback(
    @Req() req: any,
    @Res() response: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const frontendUrl =
      process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';

    if (error) {
      return response.redirect(`${frontendUrl}/auth?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return response.redirect(
        `${frontendUrl}/auth?error=${encodeURIComponent('No authorization code provided by Google')}`,
      );
    }

    try {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const customCallbackUrl = `${protocol}://${host}/auth/google/callback`;

      const { accessToken, refreshToken, redirect } =
        await this.authService.handleGoogleCallback(code, state, customCallbackUrl);

      response.cookie('accessToken', accessToken, this.getCookieOptions(req, 1000 * 60 * 10));
      response.cookie('refreshToken', refreshToken, this.getCookieOptions(req, 1000 * 60 * 60 * 24 * 10));

      const safeRedirect = redirect && redirect.startsWith('/') ? redirect : '/profile';
      return response.redirect(
        `${frontendUrl}/auth/callback?success=true&redirect=${encodeURIComponent(safeRedirect)}`,
      );
    } catch (err: any) {
      return response.redirect(
        `${frontendUrl}/auth?error=${encodeURIComponent(err.message || 'Failed to authenticate with Google')}`,
      );
    }
  }

  @HttpCode(200)
  @Post('google')
  async googleTokenLogin(
    @Req() req: any,
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.handleGoogleTokenLogin(dto);
    const { accessToken, refreshToken, ...res } = result.data;

    response.cookie('accessToken', accessToken, this.getCookieOptions(req, 1000 * 60 * 10));
    response.cookie('refreshToken', refreshToken, this.getCookieOptions(req, 1000 * 60 * 60 * 24 * 10));

    return {
      message: result.message,
      data: {
        ...res,
        accessToken,
        refreshToken,
      },
    };
  }
}
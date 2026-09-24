import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { SanitizeInterceptor } from '../common/interceptors/sanitize.interceptor';
import { ProfileService } from './profile.service';
import {
  getProfileDto,
  updateProfileDto,
  updateSettingsDto,
  createSupportTicketDto,
} from './dto/profile.request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api/profile')
@UseGuards(JwtAuthGuard)
@UseInterceptors(LoggingInterceptor, SanitizeInterceptor)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @HttpCode(200)
  @Get('check-username')
  async checkUsername(@Req() req, @Query('username') username: string) {
    const currentUserId = req?.user?.userId;
    return this.profileService.checkUsernameAvailability(username, currentUserId);
  }

  @HttpCode(200)
  @Get()
  async getProfile(@Req() req, @Query() dto: getProfileDto) {
    const email = dto?.email || req.user.email;
    return this.profileService.getProfile({ email });
  }

  @HttpCode(200)
  @Post()
  async UpdateProfile(@Req() req, @Body() dto: updateProfileDto) {
    const email = req.user.email;
    return this.profileService.UpdateProfile({ ...dto, email });
  }

  @HttpCode(200)
  @Put('settings')
  async updateSettings(@Req() req, @Body() dto: updateSettingsDto) {
    const email = req.user.email;
    return this.profileService.updateSettings(email, dto);
  }

  @HttpCode(201)
  @Post('ticket')
  async createSupportTicket(
    @Req() req,
    @Body() dto: createSupportTicketDto,
  ) {
    const { email, userId } = req.user;
    return this.profileService.createSupportTicket(userId, email, dto);
  }

  @HttpCode(200)
  @Get('quizzes')
  async GetQuizzesForProfile(@Req() req) {
    const { email } = req.user;
    return this.profileService.GetQuizzesForProfile(email);
  }

  @HttpCode(200)
  @Get('history')
  async GetHistory(@Req() req) {
    const { email, userId } = req.user;
    return this.profileService.GetHistory(userId || email);
  }

  @HttpCode(200)
  @Post('link-email')
  async linkEmail(@Req() req, @Body('email') emailToLink: string) {
    const userId = req.user.userId;
    return this.profileService.linkEmail(userId, emailToLink);
  }

  @HttpCode(200)
  @Post('unlink-email')
  async unlinkEmail(@Req() req, @Body('email') emailToUnlink: string) {
    const userId = req.user.userId;
    return this.profileService.unlinkEmail(userId, emailToUnlink);
  }
}

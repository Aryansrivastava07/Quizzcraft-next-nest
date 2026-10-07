import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { RegisterOrganizationDto, UpdateMemberRoleDto } from './dto/organization.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { Request, Response } from 'express';

@Controller()
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  // ==================== PUBLIC: REGISTER ORGANIZATION ====================
  @Post(['org/register', 'api/org/register'])
  async registerOrg(
    @Body() dto: RegisterOrganizationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.orgService.registerOrganization(dto);

    if (result.data?.accessToken && result.data?.refreshToken) {
      res.cookie('accessToken', result.data.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.cookie('refreshToken', result.data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    return result;
  }

  // ==================== SUPER ADMIN ROUTES ====================
  @Get(['super-admin/stats', 'api/super-admin/stats'])
  @UseGuards(JwtAuthGuard)
  async getSuperAdminStats(@Req() req: Request) {
    const user = (req as any).user;
    if (!user) throw new ForbiddenException('Unauthorized');
    return this.orgService.getSuperAdminStats(user);
  }

  @Get(['super-admin/orgs', 'api/super-admin/orgs'])
  @UseGuards(JwtAuthGuard)
  async getSuperAdminOrgs(@Req() req: Request) {
    const user = (req as any).user;
    if (!user) throw new ForbiddenException('Unauthorized');
    return this.orgService.getSuperAdminOrgs(user);
  }

  @Get(['super-admin/orgs/:orgId', 'api/super-admin/orgs/:orgId'])
  @UseGuards(JwtAuthGuard)
  async getSuperAdminOrgDetails(@Param('orgId') orgId: string, @Req() req: Request) {
    const user = (req as any).user;
    if (!user) throw new ForbiddenException('Unauthorized');
    return this.orgService.getSuperAdminOrgDetails(orgId, user);
  }

  @Get(['super-admin/quizzes', 'api/super-admin/quizzes'])
  @UseGuards(JwtAuthGuard)
  async getSuperAdminQuizzes(@Req() req: Request) {
    const user = (req as any).user;
    if (!user) throw new ForbiddenException('Unauthorized');
    return this.orgService.getSuperAdminQuizzes(user);
  }

  // ==================== ORG ADMIN & MEMBER ROUTES ====================
  @Get(['org/current', 'api/org/current'])
  @UseGuards(JwtAuthGuard)
  async getCurrentOrg(@Req() req: Request) {
    const user = (req as any).user;
    return this.orgService.getCurrentOrg(user);
  }

  @Get(['org/members', 'api/org/members'])
  @UseGuards(JwtAuthGuard)
  async getOrgMembers(@Req() req: Request) {
    const user = (req as any).user;
    return this.orgService.getOrgMembers(user);
  }

  @Patch(['org/members/:userId/role', 'api/org/members/:userId/role'])
  @UseGuards(JwtAuthGuard)
  async updateMemberRole(
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.orgService.updateMemberRole(targetUserId, dto, user);
  }

  @Delete(['org/members/:userId', 'api/org/members/:userId'])
  @UseGuards(JwtAuthGuard)
  async removeMember(@Param('userId') targetUserId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.orgService.removeMember(targetUserId, user);
  }

  // ==================== SLUG-BASED ORG SCOPE ROUTES ====================
  @Post(['org/join/:slug', 'api/org/join/:slug', 'org/by-slug/:slug/join', 'api/org/by-slug/:slug/join'])
  @UseGuards(JwtAuthGuard)
  async joinOrg(@Param('slug') slug: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.orgService.joinOrganization(slug, user);
  }

  @Get(['org/by-slug/:slug', 'api/org/by-slug/:slug'])
  @UseGuards(JwtAuthGuard)
  async getOrgBySlug(@Param('slug') slug: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.orgService.getOrgBySlug(slug, user);
  }

  @Get(['org/by-slug/:slug/members', 'api/org/by-slug/:slug/members'])
  @UseGuards(JwtAuthGuard)
  async getOrgMembersBySlug(@Param('slug') slug: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.orgService.getOrgMembersBySlug(slug, user);
  }

  @Get(['org/by-slug/:slug/quizzes', 'api/org/by-slug/:slug/quizzes'])
  @UseGuards(JwtAuthGuard)
  async getOrgQuizzesBySlug(@Param('slug') slug: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.orgService.getOrgQuizzesBySlug(slug, user);
  }

  @Get(['org/by-slug/:slug/groups', 'api/org/by-slug/:slug/groups'])
  @UseGuards(JwtAuthGuard)
  async getOrgGroupsBySlug(@Param('slug') slug: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.orgService.getOrgGroupsBySlug(slug, user);
  }
}

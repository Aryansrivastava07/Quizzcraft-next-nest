import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GroupService } from './group.service';
import {
  CreateGroupDto,
  JoinGroupDto,
  PostGroupMessageDto,
  UpdateGroupSettingsDto,
} from './dto/group.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { Request } from 'express';

@Controller(['groups', 'api/groups'])
@UseGuards(JwtAuthGuard)
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  async createGroup(@Body() dto: CreateGroupDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.groupService.createGroup(dto, user);
  }

  @Get()
  async getUserGroups(@Req() req: Request) {
    const user = (req as any).user;
    return this.groupService.getUserGroups(user);
  }

  @Get('explore/public')
  async getPublicGroups(@Req() req: Request) {
    const user = (req as any).user;
    return this.groupService.getPublicGroups(user);
  }

  @Get('public')
  async getPublicGroupsAlias(@Req() req: Request) {
    const user = (req as any).user;
    return this.groupService.getPublicGroups(user);
  }

  @Get(':groupId')
  async getGroupById(@Param('groupId') groupId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.groupService.getGroupById(groupId, user);
  }

  @Post('join')
  async joinGroupByCode(@Body() dto: JoinGroupDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.groupService.joinGroupByCode(dto, user);
  }

  @Post(':groupId/join')
  async joinGroupById(@Param('groupId') groupId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.groupService.joinGroupById(groupId, user);
  }

  @Post(':groupId/approve/:userId')
  async approvePendingMember(
    @Param('groupId') groupId: string,
    @Param('userId') targetUserId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.groupService.approvePendingMember(groupId, targetUserId, user);
  }

  @Post(':groupId/regenerate-code')
  async regenerateGroupCode(@Param('groupId') groupId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.groupService.regenerateGroupCode(groupId, user);
  }

  @Patch(':groupId/settings')
  async updateGroupSettings(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupSettingsDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.groupService.updateGroupSettings(groupId, dto, user);
  }

  @Get(':groupId/quizzes')
  async getGroupQuizzes(@Param('groupId') groupId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.groupService.getGroupQuizzes(groupId, user);
  }

  @Get(':groupId/gradebook')
  async getGroupGradebook(@Param('groupId') groupId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.groupService.getGroupGradebook(groupId, user);
  }

  @Get(':groupId/messages')
  async getGroupMessages(@Param('groupId') groupId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.groupService.getGroupMessages(groupId, user);
  }

  @Post(':groupId/messages')
  async postGroupMessage(
    @Param('groupId') groupId: string,
    @Body() dto: PostGroupMessageDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.groupService.postGroupMessage(groupId, dto, user);
  }

  @Patch(':groupId/messages/:messageId/pin')
  async pinGroupMessage(
    @Param('groupId') groupId: string,
    @Param('messageId') messageId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.groupService.pinGroupMessage(groupId, messageId, user);
  }

  @Delete(':groupId/messages/:messageId')
  async deleteGroupMessage(
    @Param('groupId') groupId: string,
    @Param('messageId') messageId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.groupService.deleteGroupMessage(groupId, messageId, user);
  }
}

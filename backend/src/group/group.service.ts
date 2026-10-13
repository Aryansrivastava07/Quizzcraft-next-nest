import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { Group } from '../schemas/group.schema';
import { GroupMessage } from '../schemas/group-message.schema';
import { Notification } from '../schemas/notification.schema';
import { User } from '../schemas/user.schema';
import { Quiz } from '../schemas/quiz.schema';
import {
  CreateGroupDto,
  JoinGroupDto,
  PostGroupMessageDto,
  UpdateGroupSettingsDto,
  AssignGroupQuizDto,
} from './dto/group.dto';
import { ServiceResponse } from '../common/interfaces/service-response.interface';
import { CohortWsGateway } from './cohort.gateway';

@Injectable()
export class GroupService {
  constructor(
    @Inject('GROUP_MODEL')
    private readonly groupModel: Model<Group>,
    @Inject('GROUP_MESSAGE_MODEL')
    private readonly messageModel: Model<GroupMessage>,
    @Inject('NOTIFICATION_MODEL')
    private readonly notificationModel: Model<Notification>,
    @Inject('USER_MODEL')
    private readonly userModel: Model<User>,
    @Inject('QUIZ_MODEL')
    private readonly quizModel: Model<Quiz>,
    @Inject('ATTEMPTS_MODEL')
    private readonly attemptsModel: Model<any>,
    private readonly cohortWsGateway: CohortWsGateway,
  ) {}

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'QC-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // ==================== 1. CREATE GROUP ====================
  async createGroup(dto: CreateGroupDto, userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const isExplicitPublic = dto.accessMode === 'PUBLIC';
    const isPublic = isExplicitPublic || !user.orgId;

    if (!isPublic) {
      if (user.role !== 'ORG_ADMIN' && user.role !== 'ORG_PARTNER' && user.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException('Only Organization Admins and Partners can create institutional groups');
      }
    }

    let code = this.generateCode();
    let collision = await this.groupModel.findOne({ code });
    while (collision) {
      code = this.generateCode();
      collision = await this.groupModel.findOne({ code });
    }

    const groupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const group = await this.groupModel.create({
      groupId,
      orgId: isPublic ? null : user.orgId,
      accessMode: isPublic ? 'PUBLIC' : 'ORGANIZATION',
      name: dto.name.trim(),
      description: dto.description?.trim() || '',
      code,
      creatorId: String(user._id),
      memberIds: [String(user._id)], // Creator is automatically enrolled
      pendingMemberIds: [],
      isLocked: false,
      requireApproval: dto.requireApproval || false,
    });

    // Update creator's groupIds array
    await this.userModel.findByIdAndUpdate(user._id, {
      $addToSet: { groupIds: groupId },
    });

    return {
      message: `${isPublic ? 'Public' : 'Organization'} group created successfully`,
      data: { group },
    };
  }

  // ==================== 2. GET EXPLORE PUBLIC GROUPS ====================
  async getPublicGroups(userPayload: any): Promise<ServiceResponse<any>> {
    const userId = userPayload?.userId ? String(userPayload.userId) : null;
    const groups = await this.groupModel
      .find({
        $or: [{ accessMode: 'PUBLIC' }, { orgId: null }, { orgId: { $exists: false } }],
      })
      .sort({ createdAt: -1 })
      .lean();

    const enrichedGroups = await Promise.all(
      groups.map(async (g) => {
        const [quizCount, creator] = await Promise.all([
          this.quizModel.countDocuments({ groupId: g.groupId }),
          this.userModel
            .findById(g.creatorId)
            .select('username fullName profilePicture')
            .lean(),
        ]);

        const isMember = userId ? (g.memberIds || []).includes(userId) : false;
        const isCreator = userId ? g.creatorId === userId : false;

        return {
          ...g,
          memberCount: g.memberIds?.length || 0,
          quizCount,
          isMember,
          isCreator,
          creator: creator || { username: 'Public Host' },
        };
      }),
    );

    return {
      message: 'Public cohorts retrieved successfully',
      data: { groups: enrichedGroups },
    };
  }

  // ==================== 3. GET USER GROUPS (MULTIPLE GROUPS SUPPORT) ====================
  async getUserGroups(userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    if (!user) {
      return { message: 'No groups found', data: { groups: [] } };
    }

    const userIdStr = String(user._id);
    let query: any;

    if (user.orgId && user.role === 'ORG_ADMIN') {
      // Org admin can see all groups in their org, PLUS any public groups they created/joined
      query = {
        $or: [
          { orgId: user.orgId },
          { memberIds: userIdStr },
          { creatorId: userIdStr },
        ],
      };
    } else if (user.orgId) {
      // Org member sees their org groups, PLUS any public groups they joined/created
      query = {
        $or: [
          { orgId: user.orgId, memberIds: userIdStr },
          { orgId: user.orgId, creatorId: userIdStr },
          { memberIds: userIdStr },
          { creatorId: userIdStr },
        ],
      };
    } else {
      // Public user sees groups they are a member of or created
      query = {
        $or: [{ memberIds: userIdStr }, { creatorId: userIdStr }],
      };
    }

    const groups = await this.groupModel.find(query).sort({ createdAt: -1 }).lean();

    const enrichedGroups = await Promise.all(
      groups.map(async (g) => {
        const [quizCount, unreadMessages] = await Promise.all([
          this.quizModel.countDocuments({ groupId: g.groupId }),
          this.messageModel.countDocuments({ groupId: g.groupId }),
        ]);
        const creator = await this.userModel
          .findById(g.creatorId)
          .select('username fullName profilePicture')
          .lean();

        return {
          ...g,
          memberCount: g.memberIds?.length || 0,
          pendingCount: g.pendingMemberIds?.length || 0,
          quizCount,
          totalMessages: unreadMessages,
          isMember: (g.memberIds || []).includes(userIdStr),
          isCreator: g.creatorId === userIdStr,
          creator: creator || { username: 'Instructor' },
        };
      }),
    );

    return {
      message: 'User groups retrieved',
      data: { groups: enrichedGroups },
    };
  }

  // ==================== 4. GET SINGLE GROUP DETAILS ====================
  async getGroupById(groupId: string, userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    if (!user) {
      throw new ForbiddenException('Unauthorized');
    }

    const group = await this.groupModel.findOne({ groupId }).lean();
    if (!group) throw new NotFoundException('Group not found');

    const userIdStr = String(user._id);
    let isCreator = group.creatorId === userIdStr;

    // Self-healing: if creatorId is missing or corrupt, check user's groupIds or single-member creation
    if (!isCreator && (!group.creatorId || group.creatorId === 'undefined')) {
      if ((user.groupIds || []).includes(group.groupId) || (group.memberIds || []).length <= 1) {
        isCreator = true;
        await this.groupModel.updateOne(
          { groupId },
          { creatorId: userIdStr, $addToSet: { memberIds: userIdStr } }
        );
        group.creatorId = userIdStr;
      }
    }

    // Auto-heal membership if creator is somehow missing from memberIds
    if (isCreator && !(group.memberIds || []).includes(userIdStr)) {
      await this.groupModel.updateOne({ groupId }, { $addToSet: { memberIds: userIdStr } });
      group.memberIds = [...(group.memberIds || []), userIdStr];
    }

    const isMember = (group.memberIds || []).includes(userIdStr) || isCreator;
    const isSuper = user.role === 'SUPER_ADMIN' || Boolean((user as any).isSuperAdmin);

    // If org-scoped group: enforce org access
    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup) {
      if (!isSuper && user.orgId !== group.orgId) {
        throw new ForbiddenException('This group belongs to a private organization workspace.');
      }
      const isOrgAdmin = user.role === 'ORG_ADMIN';
      if (!isMember && !isCreator && !isOrgAdmin && !isSuper) {
        throw new ForbiddenException('You are not a member of this institutional group');
      }
    }

    const [members, pendingMembers, creator, quizCount] = await Promise.all([
      this.userModel
        .find({ _id: { $in: group.memberIds || [] } })
        .select('_id username email fullName role xp profilePicture')
        .lean(),
      this.userModel
        .find({ _id: { $in: group.pendingMemberIds || [] } })
        .select('_id username email fullName role profilePicture')
        .lean(),
      this.userModel
        .findById(group.creatorId)
        .select('username fullName profilePicture email')
        .lean(),
      this.quizModel.countDocuments({ groupId }),
    ]);

    const isPartnerOrAdmin =
      isCreator ||
      isSuper ||
      (isOrgGroup && user.role === 'ORG_ADMIN') ||
      (isOrgGroup && user.role === 'ORG_PARTNER');

    return {
      message: 'Group retrieved',
      data: {
        group: {
          ...group,
          memberCount: members.length,
          quizCount,
          creator: creator || { username: 'Instructor' },
        },
        members: members.map((m) => ({
          userId: String(m._id),
          username: m.username,
          email: m.email,
          fullName: m.fullName,
          role: m.role,
          xp: m.xp || 0,
          profilePicture: m.profilePicture || '',
        })),
        pendingMembers: pendingMembers.map((m) => ({
          userId: String(m._id),
          username: m.username,
          email: m.email,
          fullName: m.fullName,
        })),
        isPartnerOrAdmin,
        isCreator,
        isMember,
      },
    };
  }

  // ==================== 5. JOIN GROUP VIA CODE / INVITE LINK ====================
  async joinGroupByCode(dto: JoinGroupDto, userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId);
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const code = dto.code.trim().toUpperCase();
    const group = await this.groupModel.findOne({ code });
    if (!group) {
      throw new NotFoundException(`No group found with invite code "${code}"`);
    }

    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup) {
      if (!user.orgId || user.orgId !== group.orgId) {
        throw new ForbiddenException(
          'This group is restricted to members of its organization domain.',
        );
      }
    }

    const userIdStr = String(user._id);

    if (group.memberIds.includes(userIdStr)) {
      return {
        message: 'You are already a member of this group',
        data: { groupId: group.groupId, status: 'ALREADY_MEMBER' },
      };
    }

    if (group.isLocked) {
      throw new BadRequestException('This group is currently locked against new enrollments');
    }

    if (group.requireApproval) {
      if (group.pendingMemberIds.includes(userIdStr)) {
        return {
          message: 'Your request to join is pending approval',
          data: { groupId: group.groupId, status: 'PENDING_APPROVAL' },
        };
      }
      group.pendingMemberIds.push(userIdStr);
      await group.save();

      // Notify Group Creator
      await this.notificationModel.create({
        notificationId: `notif_${Date.now()}`,
        userId: group.creatorId,
        title: 'New Member Approval Request',
        message: `@${user.username} requested to join ${group.name}`,
        type: 'GROUP_INVITE',
        link: isOrgGroup ? `/${user.orgSlug}/groups/${group.groupId}?tab=members` : `/groups/${group.groupId}?tab=members`,
        read: false,
      });

      return {
        message: 'Join request submitted! The host will review your admission.',
        data: { groupId: group.groupId, status: 'PENDING_APPROVAL' },
      };
    }

    // Standard Direct Join
    group.memberIds.push(userIdStr);
    await group.save();

    await this.userModel.findByIdAndUpdate(user._id, {
      $addToSet: { groupIds: group.groupId },
    });

    return {
      message: `Enrolled successfully into ${group.name}! Welcome aboard.`,
      data: { groupId: group.groupId, status: 'ENROLLED' },
    };
  }

  // ==================== 6. JOIN GROUP DIRECTLY BY ID (1-CLICK PUBLIC JOIN) ====================
  async joinGroupById(groupId: string, userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId);
    if (!user) throw new ForbiddenException('User not found');

    const group = await this.groupModel.findOne({ groupId });
    if (!group) throw new NotFoundException('Group not found');

    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup) {
      if (!user.orgId || user.orgId !== group.orgId) {
        throw new ForbiddenException('This group belongs to a private organization.');
      }
    }

    const userIdStr = String(user._id);
    if (group.memberIds.includes(userIdStr)) {
      return {
        message: 'You are already a member of this cohort',
        data: { groupId: group.groupId, status: 'ALREADY_MEMBER' },
      };
    }

    if (group.isLocked) {
      throw new BadRequestException('This group is locked against new members');
    }

    if (group.requireApproval) {
      if (group.pendingMemberIds.includes(userIdStr)) {
        return {
          message: 'Your request to join is pending approval',
          data: { groupId: group.groupId, status: 'PENDING_APPROVAL' },
        };
      }
      group.pendingMemberIds.push(userIdStr);
      await group.save();
      return {
        message: 'Join request submitted! Awaiting host approval.',
        data: { groupId: group.groupId, status: 'PENDING_APPROVAL' },
      };
    }

    group.memberIds.push(userIdStr);
    await group.save();

    await this.userModel.findByIdAndUpdate(user._id, {
      $addToSet: { groupIds: group.groupId },
    });

    return {
      message: `Successfully joined ${group.name}!`,
      data: { groupId: group.groupId, status: 'ENROLLED' },
    };
  }

  // ==================== 7. APPROVE PENDING MEMBER ====================
  async approvePendingMember(
    groupId: string,
    targetUserId: string,
    userPayload: any,
  ): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    const group = await this.groupModel.findOne({ groupId });
    if (!group) throw new NotFoundException('Group not found');

    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup && user?.orgId !== group.orgId && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Unauthorized');
    }

    if (group.creatorId !== String(user?._id) && (!isOrgGroup || user?.role !== 'ORG_ADMIN')) {
      throw new ForbiddenException('Only the group instructor or admin can approve members');
    }

    group.pendingMemberIds = (group.pendingMemberIds || []).filter((id) => id !== targetUserId);
    if (!group.memberIds.includes(targetUserId)) {
      group.memberIds.push(targetUserId);
    }
    await group.save();

    await this.userModel.findByIdAndUpdate(targetUserId, {
      $addToSet: { groupIds: group.groupId },
    });

    // Notify Approved Cadet
    await this.notificationModel.create({
      notificationId: `notif_${Date.now()}`,
      userId: targetUserId,
      title: 'Group Admission Approved! 🎉',
      message: `You were approved to join ${group.name}. Access your assigned missions now.`,
      type: 'GROUP_INVITE',
      link: isOrgGroup && user?.orgSlug ? `/${user.orgSlug}/groups/${group.groupId}` : `/groups/${group.groupId}`,
      read: false,
    });

    return {
      message: 'Member admission approved',
      data: { userId: targetUserId, groupId },
    };
  }

  // ==================== 8. REGENERATE CODE & UPDATE SETTINGS ====================
  async regenerateGroupCode(groupId: string, userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    const group = await this.groupModel.findOne({ groupId });
    if (!group) throw new NotFoundException('Group not found');

    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup && user?.orgId !== group.orgId && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Unauthorized');
    }

    if (group.creatorId !== String(user?._id) && (!isOrgGroup || user?.role !== 'ORG_ADMIN')) {
      throw new ForbiddenException('Unauthorized');
    }

    let newCode = this.generateCode();
    let collision = await this.groupModel.findOne({ code: newCode });
    while (collision) {
      newCode = this.generateCode();
      collision = await this.groupModel.findOne({ code: newCode });
    }

    group.code = newCode;
    await group.save();

    return {
      message: 'Invite code regenerated successfully',
      data: { code: group.code },
    };
  }

  async updateGroupSettings(
    groupId: string,
    dto: UpdateGroupSettingsDto,
    userPayload: any,
  ): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    const group = await this.groupModel.findOne({ groupId });
    if (!group) throw new NotFoundException('Group not found');

    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup && user?.orgId !== group.orgId && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Unauthorized');
    }

    if (group.creatorId !== String(user?._id) && (!isOrgGroup || user?.role !== 'ORG_ADMIN')) {
      throw new ForbiddenException('Unauthorized');
    }

    if (dto.name !== undefined) group.name = dto.name.trim();
    if (dto.description !== undefined) group.description = dto.description.trim();
    if (dto.isLocked !== undefined) group.isLocked = dto.isLocked;
    if (dto.requireApproval !== undefined) group.requireApproval = dto.requireApproval;

    await group.save();

    return {
      message: 'Group settings updated',
      data: { group },
    };
  }

  // ==================== 9. GROUP QUIZZES (WITH DUE DATES & STATUS) ====================
  async getGroupQuizzes(groupId: string, userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    const group = await this.groupModel.findOne({ groupId }).lean();
    if (!group) throw new NotFoundException('Group not found');

    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup && user?.orgId !== group.orgId && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Unauthorized');
    }

    const quizzes = await this.quizModel
      .find({ groupId })
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();
    const enrichedQuizzes = quizzes.map((q) => {
      let deadlineStatus = 'NO_DEADLINE';
      if (q.dueDate) {
        const due = new Date(q.dueDate);
        const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (diffHours < 0) {
          deadlineStatus = 'PAST_DUE';
        } else if (diffHours <= 24) {
          deadlineStatus = 'DUE_SOON';
        } else {
          deadlineStatus = 'ACTIVE';
        }
      }

      return {
        quizId: q.quizId,
        title: q.title,
        coverImage: q.coverImage || '',
        pin: q.pin,
        status: q.status,
        deploymentType: q.deploymentType,
        dueDate: q.dueDate,
        scheduledFor: q.scheduledFor,
        liveUntil: q.liveUntil,
        liveDurationMinutes: q.liveDurationMinutes,
        deadlineStatus,
        questionCount: q.questions?.length || 0,
        createdAt: (q as any).createdAt,
      };
    });

    return {
      message: 'Group quizzes retrieved',
      data: { quizzes: enrichedQuizzes },
    };
  }

  // ==================== 10. GRADEBOOK & CSV EXPORT MATRIX ====================
  async getGroupGradebook(groupId: string, userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    const group = await this.groupModel.findOne({ groupId }).lean();
    if (!group) throw new NotFoundException('Group not found');

    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup && user?.orgId !== group.orgId && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Unauthorized');
    }

    const [members, quizzes] = await Promise.all([
      this.userModel
        .find({ _id: { $in: group.memberIds || [] } })
        .select('_id username email fullName role')
        .lean(),
      this.quizModel.find({ groupId }).select('quizId title dueDate questions').lean(),
    ]);

    // Build the matrix of student results across quizzes
    const quizIds = quizzes.map((q) => q.quizId);
    const attempts = await this.attemptsModel
      .find({
        quizId: { $in: quizIds },
        userId: { $in: members.map((m) => String(m._id)) },
      })
      .lean();

    const matrix = members.map((member) => {
      const memberIdStr = String(member._id);
      const quizResults: Record<string, any> = {};

      quizzes.forEach((quiz) => {
        const userAttempt = attempts.find(
          (a) => a.quizId === quiz.quizId && a.userId === memberIdStr,
        );

        if (userAttempt) {
          quizResults[quiz.quizId] = {
            completed: true,
            score: userAttempt.score || 0,
            accuracy: userAttempt.accuracy || 0,
            submittedAt: userAttempt.createdAt,
          };
        } else {
          quizResults[quiz.quizId] = {
            completed: false,
            score: null,
            accuracy: null,
            submittedAt: null,
          };
        }
      });

      return {
        userId: memberIdStr,
        username: member.username,
        fullName: member.fullName,
        email: member.email,
        quizzes: quizResults,
      };
    });

    return {
      message: 'Gradebook generated',
      data: {
        quizzes: quizzes.map((q) => ({ quizId: q.quizId, title: q.title, dueDate: q.dueDate })),
        matrix,
      },
    };
  }

  // ==================== 11. DISCUSSION ROOM MESSAGES ====================
  async getGroupMessages(groupId: string, userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    const group = await this.groupModel.findOne({ groupId }).lean();
    if (!group) throw new NotFoundException('Group not found');

    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup && user?.orgId !== group.orgId && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Unauthorized');
    }

    const messages = await this.messageModel
      .find({ groupId })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    return {
      message: 'Group messages retrieved',
      data: { messages },
    };
  }

  async postGroupMessage(
    groupId: string,
    dto: PostGroupMessageDto,
    userPayload: any,
  ): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    if (!user) throw new ForbiddenException('User not found');

    const group = await this.groupModel.findOne({ groupId });
    if (!group) throw new NotFoundException('Group not found');

    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup && user.orgId !== group.orgId && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Unauthorized');
    }

    const userIdStr = String(user._id);
    const isCreator = group.creatorId === userIdStr;
    const isMember = (group.memberIds || []).includes(userIdStr) || isCreator;

    if (!isMember && (!isOrgGroup || user.role !== 'ORG_ADMIN')) {
      throw new ForbiddenException('You must be a member of this group to post messages');
    }

    // Auto-heal membership if creator is posting
    if (isCreator && !(group.memberIds || []).includes(userIdStr)) {
      await this.groupModel.updateOne({ groupId }, { $addToSet: { memberIds: userIdStr } });
      group.memberIds.push(userIdStr);
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const message = await this.messageModel.create({
      messageId,
      groupId,
      authorId: String(user._id),
      authorName: user.fullName || user.username,
      authorAvatar: user.profilePicture || '',
      authorRole: user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : user.role === 'ORG_ADMIN' ? 'ORG_ADMIN' : user.role === 'ORG_PARTNER' ? 'ORG_PARTNER' : (user.role === 'ORG_STD' ? 'ORG_STD' : 'PUBLIC_USER'),
      content: dto.content.trim(),
      isPinned: false,
      questionContext: dto.questionContext ? dto.questionContext : undefined,
    });

    // If student asked about a question, notify the instructor
    if (dto.questionContext && group.creatorId !== String(user._id)) {
      await this.notificationModel.create({
        notificationId: `notif_${Date.now()}`,
        userId: group.creatorId,
        title: `Question Discussion in ${group.name}`,
        message: `@${user.username} asked for clarification on Question #${dto.questionContext.questionId}`,
        type: 'DISCUSSION_REPLY',
        link: isOrgGroup && user?.orgSlug ? `/${user.orgSlug}/groups/${groupId}?tab=discussion` : `/groups/${groupId}?tab=discussion`,
        read: false,
      });
    }

    // Real-time broadcast to connected clients via WebSocket
    try {
      this.cohortWsGateway.broadcastNewMessage(groupId, message);
    } catch (wsErr) {
      // Non-blocking
    }

    return {
      message: 'Message posted successfully',
      data: { message },
    };
  }

  async pinGroupMessage(
    groupId: string,
    messageId: string,
    userPayload: any,
  ): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    const group = await this.groupModel.findOne({ groupId }).lean();
    if (!group) throw new NotFoundException('Group not found');

    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup && user?.orgId !== group.orgId && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Unauthorized');
    }

    if (group.creatorId !== String(user?._id) && (!isOrgGroup || user?.role !== 'ORG_ADMIN')) {
      throw new ForbiddenException('Only the instructor or admin can pin messages');
    }

    const message = await this.messageModel.findOne({ messageId, groupId });
    if (!message) throw new NotFoundException('Message not found');

    message.isPinned = !message.isPinned;
    await message.save();

    // Real-time broadcast to connected clients via WebSocket
    try {
      this.cohortWsGateway.broadcastPinMessage(groupId, messageId, message.isPinned);
    } catch (wsErr) {
      // Non-blocking
    }

    return {
      message: message.isPinned ? 'Message pinned as announcement' : 'Message unpinned',
      data: { messageId, isPinned: message.isPinned },
    };
  }

  async deleteGroupMessage(
    groupId: string,
    messageId: string,
    userPayload: any,
  ): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    const group = await this.groupModel.findOne({ groupId }).lean();
    if (!group) throw new NotFoundException('Group not found');

    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup && user?.orgId !== group.orgId && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Unauthorized');
    }

    const message = await this.messageModel.findOne({ messageId, groupId });
    if (!message) throw new NotFoundException('Message not found');

    const isAuthor = message.authorId === String(user?._id);
    const isInstructor = group.creatorId === String(user?._id) || (isOrgGroup && user?.role === 'ORG_ADMIN');

    if (!isAuthor && !isInstructor) {
      throw new ForbiddenException('You do not have permission to delete this message');
    }

    await this.messageModel.deleteOne({ messageId });

    // Real-time broadcast to connected clients via WebSocket
    try {
      this.cohortWsGateway.broadcastDeleteMessage(groupId, messageId);
    } catch (wsErr) {
      // Non-blocking
    }

    return {
      message: 'Message deleted',
      data: { messageId },
    };
  }

  // ==================== 12. ASSIGN QUIZ TO COHORT (WITH ARENA SUPPORT) ====================
  async assignQuizToGroup(
    groupId: string,
    dto: AssignGroupQuizDto,
    userPayload: any,
  ): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    const group = await this.groupModel.findOne({ groupId });
    if (!group) throw new NotFoundException('Group not found');

    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup && user?.orgId !== group.orgId && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Unauthorized');
    }

    const isInstructor =
      group.creatorId === String(user?._id) ||
      (isOrgGroup && user?.role === 'ORG_ADMIN') ||
      user?.role === 'SUPER_ADMIN';

    if (!isInstructor) {
      throw new ForbiddenException('Only the instructor can assign quizzes to this cohort');
    }

    const quiz = await this.quizModel.findOne({ quizId: dto.quizId });
    if (!quiz) throw new NotFoundException('Quiz not found');

    const now = new Date();
    const durationMinutes = Math.max(10, Math.min(1440, Number(dto.durationMinutes) || 60));

    if (dto.isArena) {
      let scheduledFor = now;
      if (dto.scheduledFor) {
        const parsed = new Date(dto.scheduledFor);
        if (!isNaN(parsed.getTime())) {
          scheduledFor = parsed;
        }
      }
      const liveUntil = new Date(scheduledFor.getTime() + durationMinutes * 60 * 1000);
      const isUpcoming = scheduledFor.getTime() > now.getTime();

      quiz.deploymentType = isUpcoming ? 'SCHEDULED' : 'LIVE';
      quiz.status = isUpcoming ? 'SCHEDULED' : 'LIVE';
      quiz.scheduledFor = scheduledFor;
      quiz.liveDurationMinutes = durationMinutes;
      quiz.liveUntil = liveUntil;
    } else {
      quiz.deploymentType = 'ANYTIME';
      quiz.status = 'ANYTIME';
      if (dto.dueDate) {
        const parsedDue = new Date(dto.dueDate);
        if (!isNaN(parsedDue.getTime())) {
          quiz.dueDate = parsedDue;
        }
      }
    }

    quiz.groupId = groupId;
    quiz.isDeployed = true;
    await quiz.save();

    // Broadcast WebSocket event to all cadets in the cohort
    try {
      this.cohortWsGateway.broadcastQuizAssigned(groupId, quiz);
    } catch (wsErr) {
      // Non-blocking
    }

    // Notify cohort members (excluding instructor)
    const cadetIds = (group.memberIds || []).filter((id) => id !== String(user?._id));
    if (cadetIds.length > 0) {
      const notifs = cadetIds.map((mId) => ({
        notificationId: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: mId,
        title: dto.isArena ? `Cohort Arena: ${quiz.title}` : `New Quiz Assigned: ${quiz.title}`,
        message: dto.isArena
          ? `An exclusive arena has been scheduled in ${group.name}. Check start times and compete!`
          : `Instructor assigned "${quiz.title}" to ${group.name}. Access your mission now.`,
        type: 'QUIZ_ASSIGNED',
        link: `/groups/${groupId}?tab=quizzes`,
        read: false,
      }));
      await this.notificationModel.insertMany(notifs).catch(() => {});
    }

    return {
      message: dto.isArena ? 'Cohort Arena successfully scheduled!' : 'Quiz successfully assigned to cohort!',
      data: { quiz },
    };
  }

  // ==================== 13. COHORT QUIZ RESULTS & LEADERBOARD (VISIBLE TO EVERYONE) ====================
  async getCohortQuizResults(
    groupId: string,
    quizId: string,
    userPayload: any,
  ): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    const group = await this.groupModel.findOne({ groupId }).lean();
    if (!group) throw new NotFoundException('Group not found');

    const userIdStr = String(user?._id);
    const isMember = (group.memberIds || []).includes(userIdStr) || group.creatorId === userIdStr;
    const isSuper = user?.role === 'SUPER_ADMIN';

    if (!isMember && !isSuper) {
      throw new ForbiddenException('You must be a member of this cohort to view results');
    }

    const quiz = await this.quizModel.findOne({ quizId, groupId }).lean();
    if (!quiz) throw new NotFoundException('Assigned quiz not found in this cohort');

    // Fetch cohort members
    const members = await this.userModel
      .find({ _id: { $in: group.memberIds || [] } })
      .select('_id username fullName profilePicture role')
      .lean();

    // Fetch all attempts for this quiz by cohort members
    const memberIdStrs = members.map((m) => String(m._id));
    const attempts = await this.attemptsModel
      .find({
        quizId,
        userId: { $in: memberIdStrs },
      })
      .sort({ score: -1, totalTimeSpentSeconds: 1 })
      .lean();

    const memberMap = new Map(members.map((m) => [String(m._id), m]));

    // Construct ranked leaderboard
    const leaderboard = attempts.map((att: any, idx: number) => {
      const mem = memberMap.get(String(att.userId));
      const totalQ = quiz.questions?.length || 10;
      const computedAccuracy =
        typeof att.accuracy === 'number'
          ? Math.round(att.accuracy)
          : Math.min(100, Math.round(((att.score || 0) / totalQ) * 100));

      return {
        rank: idx + 1,
        userId: String(att.userId),
        username: mem?.username || 'Cadet',
        fullName: mem?.fullName || mem?.username || 'Cadet',
        profilePicture: mem?.profilePicture || '',
        score: att.score ?? 0,
        accuracy: computedAccuracy,
        timeSpentSeconds: att.totalTimeSpentSeconds || 0,
        submittedAt: att.createdAt || att.lastUpdateAt || null,
        isCreator: String(att.userId) === group.creatorId,
      };
    });

    const attemptedUserIds = new Set(attempts.map((a: any) => String(a.userId)));
    const unattemptedMembers = members
      .filter((m) => !attemptedUserIds.has(String(m._id)))
      .map((m) => ({
        userId: String(m._id),
        username: m.username,
        fullName: m.fullName || m.username,
        profilePicture: m.profilePicture || '',
        isCreator: String(m._id) === group.creatorId,
        hasAttempted: false,
      }));

    const totalAttempts = leaderboard.length;
    const avgScore = totalAttempts > 0
      ? Math.round((leaderboard.reduce((acc, curr) => acc + curr.score, 0) / totalAttempts) * 10) / 10
      : 0;
    const avgAccuracy = totalAttempts > 0
      ? Math.round(leaderboard.reduce((acc, curr) => acc + curr.accuracy, 0) / totalAttempts)
      : 0;
    const avgTimeSeconds = totalAttempts > 0
      ? Math.round(leaderboard.reduce((acc, curr) => acc + curr.timeSpentSeconds, 0) / totalAttempts)
      : 0;

    return {
      message: 'Cohort quiz results retrieved',
      data: {
        quiz: {
          quizId: quiz.quizId,
          title: quiz.title,
          pin: quiz.pin,
          totalQuestions: quiz.questions?.length || 0,
          deploymentType: quiz.deploymentType,
          status: quiz.status,
          scheduledFor: quiz.scheduledFor,
          liveUntil: quiz.liveUntil,
          dueDate: quiz.dueDate,
        },
        leaderboard,
        unattemptedMembers,
        stats: {
          totalMembers: members.length,
          totalAttempts,
          avgScore,
          avgAccuracy,
          avgTimeSeconds,
        },
      },
    };
  }

  // ==================== 14. UNASSIGN QUIZ FROM COHORT ====================
  async unassignQuiz(
    groupId: string,
    quizId: string,
    userPayload: any,
  ): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    const group = await this.groupModel.findOne({ groupId }).lean();
    if (!group) throw new NotFoundException('Group not found');

    const isOrgGroup = group.orgId && group.accessMode !== 'PUBLIC';
    if (isOrgGroup && user?.orgId !== group.orgId && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Unauthorized');
    }

    const isInstructor =
      group.creatorId === String(user?._id) ||
      (isOrgGroup && user?.role === 'ORG_ADMIN') ||
      user?.role === 'SUPER_ADMIN';

    if (!isInstructor) {
      throw new ForbiddenException('Only the instructor can remove assigned quizzes');
    }

    const quiz = await this.quizModel.findOne({ quizId, groupId });
    if (!quiz) throw new NotFoundException('Quiz not found in this cohort');

    quiz.groupId = null;
    await quiz.save();

    return {
      message: 'Quiz unassigned from cohort successfully',
      data: { quizId },
    };
  }
}


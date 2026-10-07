import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { Organization } from '../schemas/organization.schema';
import { User } from '../schemas/user.schema';
import { Quiz } from '../schemas/quiz.schema';
import { Group } from '../schemas/group.schema';
import { RegisterOrganizationDto, UpdateMemberRoleDto } from './dto/organization.dto';
import { hashPassword } from '../common/utils/hash.util';
import { ConfigService } from '@nestjs/config';
import { generateToken } from '../common/utils/token.util';
import { ServiceResponse } from '../common/interfaces/service-response.interface';

@Injectable()
export class OrganizationService {
  constructor(
    @Inject('ORGANIZATION_MODEL')
    private readonly orgModel: Model<Organization>,
    @Inject('USER_MODEL')
    private readonly userModel: Model<User>,
    @Inject('QUIZ_MODEL')
    private readonly quizModel: Model<Quiz>,
    @Inject('GROUP_MODEL')
    private readonly groupModel: Model<Group>,
    private readonly configService: ConfigService,
  ) {}

  private getSalt(): number {
    return Number(this.configService.get<number>('SALT') || 10);
  }

  // ==================== PUBLIC: REGISTER ORGANIZATION ====================
  async registerOrganization(
    dto: RegisterOrganizationDto,
  ): Promise<ServiceResponse<any>> {
    const slug = dto.slug.toLowerCase().trim();
    const existingOrg = await this.orgModel.findOne({ slug });
    if (existingOrg) {
      throw new ConflictException(`Organization with slug "${slug}" already exists`);
    }

    const adminEmail = dto.adminEmail.toLowerCase().trim();
    const existingEmail = await this.userModel.findOne({
      $or: [{ email: adminEmail }, { emails: adminEmail }],
    });
    if (existingEmail) {
      throw new ConflictException('An account with this admin email already exists');
    }

    const adminUsername = dto.adminUsername.toLowerCase().trim();
    const existingUsername = await this.userModel.findOne({ username: adminUsername });
    if (existingUsername) {
      throw new ConflictException('Admin username is already taken');
    }

    const orgId = `org_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const hashedPassword = await hashPassword(dto.adminPassword, this.getSalt());

    // 1. Create the Admin user
    const adminUser = await this.userModel.create({
      username: adminUsername,
      email: adminEmail,
      emails: [adminEmail],
      password: hashedPassword,
      fullName: (dto.adminFullName?.trim() || adminUsername),
      institution: dto.name.trim(),
      verified: true, // Organization creator auto-verified
      role: 'ORG_ADMIN',
      orgId,
      orgSlug: slug,
      groupIds: [],
    });

    // 2. Create the Organization
    const organization = await this.orgModel.create({
      orgId,
      slug,
      name: dto.name.trim(),
      allowedEmailDomain: dto.allowedEmailDomain ? dto.allowedEmailDomain.toLowerCase().trim() : undefined,
      ownerId: String(adminUser._id),
      status: 'ACTIVE',
      maxSeats: 100,
    });

    // 3. Generate Auth Tokens for instant login
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET') || 'access_secret';
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh_secret';

    const accessToken = generateToken(
      { userId: String(adminUser._id), email: adminUser.email },
      accessSecret,
      '7d',
    );
    const refreshToken = generateToken(
      { userId: String(adminUser._id), email: adminUser.email },
      refreshSecret,
      '30d',
    );
    adminUser.refreshToken = refreshToken;
    await adminUser.save();

    return {
      message: 'Organization and admin account created successfully',
      data: {
        organization: {
          orgId: organization.orgId,
          slug: organization.slug,
          name: organization.name,
          allowedEmailDomain: organization.allowedEmailDomain,
          status: organization.status,
        },
        user: {
          userId: String(adminUser._id),
          username: adminUser.username,
          email: adminUser.email,
          fullName: adminUser.fullName,
          role: adminUser.role,
          orgId: adminUser.orgId,
        },
        accessToken,
        refreshToken,
      },
    };
  }

  // ==================== SUPER ADMIN ENDPOINTS ====================
  private async verifySuperAdmin(userPayload: any) {
    if (!userPayload?.userId) {
      throw new ForbiddenException('Unauthorized access');
    }
    const user = await this.userModel.findById(userPayload.userId).lean();
    if (!user || (user.role !== 'SUPER_ADMIN' && !(user as any).isSuperAdmin)) {
      throw new ForbiddenException('Only Super Admins can access platform administration');
    }
    return user;
  }

  async getSuperAdminStats(userPayload: any): Promise<ServiceResponse<any>> {
    await this.verifySuperAdmin(userPayload);

    const [totalOrgs, totalUsers, totalQuizzes, activeLiveRooms] = await Promise.all([
      this.orgModel.countDocuments(),
      this.userModel.countDocuments(),
      this.quizModel.countDocuments(),
      this.quizModel.countDocuments({ status: 'LIVE' }),
    ]);

    const orgUsers = await this.userModel.countDocuments({ role: { $ne: 'PUBLIC_USER' } });
    const publicUsers = totalUsers - orgUsers;

    return {
      message: 'Super admin platform stats retrieved',
      data: {
        totalOrgs,
        totalUsers,
        orgUsers,
        publicUsers,
        totalQuizzes,
        activeLiveRooms,
      },
    };
  }

  async getSuperAdminOrgs(userPayload: any): Promise<ServiceResponse<any>> {
    await this.verifySuperAdmin(userPayload);

    const orgs = await this.orgModel.find().sort({ createdAt: -1 }).lean();

    const enrichedOrgs = await Promise.all(
      orgs.map(async (org) => {
        const [memberCount, groupCount, quizCount] = await Promise.all([
          this.userModel.countDocuments({ orgId: org.orgId }),
          this.groupModel.countDocuments({ orgId: org.orgId }),
          this.quizModel.countDocuments({ orgId: org.orgId }),
        ]);

        let owner: any = null;
        if (org.ownerId) {
          try {
            owner = await this.userModel.findById(org.ownerId).select('username email fullName').lean();
          } catch {
            // Ignore potential CastError if ownerId was stored in legacy non-ObjectId format
          }
        }

        return {
          ...org,
          memberCount,
          groupCount,
          quizCount,
          owner: owner || { username: 'Admin', email: '' },
        };
      }),
    );

    return {
      message: 'All organizations retrieved',
      data: { organizations: enrichedOrgs },
    };
  }

  async getSuperAdminOrgDetails(orgId: string, userPayload: any): Promise<ServiceResponse<any>> {
    await this.verifySuperAdmin(userPayload);

    const org = await this.orgModel.findOne({ $or: [{ orgId }, { slug: orgId }] }).lean();
    if (!org) throw new NotFoundException('Organization not found');

    const [members, groups, quizzes] = await Promise.all([
      this.userModel
        .find({ orgId: org.orgId })
        .select('username email fullName role xp verified createdAt profilePicture')
        .sort({ createdAt: -1 })
        .lean(),
      this.groupModel.find({ orgId: org.orgId }).sort({ createdAt: -1 }).lean(),
      this.quizModel
        .find({ orgId: org.orgId })
        .select('quizId title status deploymentType questions isPractice createdAt stats ownerEmail')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const totalMembers = members.length;
    const totalQuizzes = quizzes.length;
    const totalGroups = groups.length;
    const totalAttempts = quizzes.reduce(
      (sum: number, q: any) => sum + (q.stats?.peopleAttempted || 0),
      0,
    );

    return {
      message: 'Organization details retrieved',
      data: {
        organization: org,
        members,
        groups,
        quizzes,
        stats: {
          totalMembers,
          totalQuizzes,
          totalGroups,
          totalAttempts,
        },
      },
    };
  }

  async getSuperAdminQuizzes(userPayload: any): Promise<ServiceResponse<any>> {
    await this.verifySuperAdmin(userPayload);

    const quizzes = await this.quizModel
      .find()
      .sort({ createdAt: -1 })
      .limit(100)
      .select('quizId title ownerEmail status accessMode deploymentType orgId groupId isPractice createdAt')
      .lean();

    return {
      message: 'Global quizzes overview retrieved',
      data: { quizzes },
    };
  }

  // ==================== ORG ADMIN / ORG MEMBER ENDPOINTS ====================
  async getCurrentOrg(userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    if (!user || !user.orgId) {
      throw new NotFoundException('User does not belong to any organization');
    }

    const org = await this.orgModel.findOne({ orgId: user.orgId }).lean();
    if (!org) throw new NotFoundException('Organization not found');

    const [memberCount, groupCount, quizCount] = await Promise.all([
      this.userModel.countDocuments({ orgId: user.orgId }),
      this.groupModel.countDocuments({ orgId: user.orgId }),
      this.quizModel.countDocuments({ orgId: user.orgId }),
    ]);

    return {
      message: 'Current organization retrieved',
      data: {
        organization: org,
        stats: {
          memberCount,
          groupCount,
          quizCount,
          maxSeats: org.maxSeats || 100,
        },
        userRole: user.role,
      },
    };
  }

  async getOrgMembers(userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    if (!user || !user.orgId) {
      throw new NotFoundException('User does not belong to any organization');
    }

    const members = await this.userModel
      .find({ orgId: user.orgId })
      .select('_id username email fullName role xp verified profilePicture createdAt groupIds')
      .sort({ createdAt: -1 })
      .lean();

    return {
      message: 'Organization members retrieved',
      data: {
        members: members.map((m) => ({
          userId: String(m._id),
          username: m.username,
          email: m.email,
          fullName: m.fullName,
          role: m.role,
          xp: m.xp || 0,
          profilePicture: m.profilePicture || '',
          groupIds: m.groupIds || [],
          createdAt: (m as any).createdAt,
        })),
      },
    };
  }

  async updateMemberRole(
    targetUserId: string,
    dto: UpdateMemberRoleDto,
    userPayload: any,
  ): Promise<ServiceResponse<any>> {
    const admin = await this.userModel.findById(userPayload.userId).lean();
    if (!admin || (admin.role !== 'ORG_ADMIN' && admin.role !== 'SUPER_ADMIN')) {
      throw new ForbiddenException('Only Organization Admins or Super Admins can modify member roles');
    }

    const targetUser = await this.userModel.findById(targetUserId);
    if (!targetUser || (admin.role !== 'SUPER_ADMIN' && targetUser.orgId !== admin.orgId)) {
      throw new NotFoundException('Target user is not a member of your organization');
    }

    targetUser.role = dto.role;
    await targetUser.save();

    return {
      message: `User role updated to ${dto.role}`,
      data: {
        userId: String(targetUser._id),
        username: targetUser.username,
        role: targetUser.role,
      },
    };
  }

  async removeMember(targetUserId: string, userPayload: any): Promise<ServiceResponse<any>> {
    const admin = await this.userModel.findById(userPayload.userId).lean();
    if (!admin || (admin.role !== 'ORG_ADMIN' && admin.role !== 'SUPER_ADMIN')) {
      throw new ForbiddenException('Only Organization Admins or Super Admins can remove members');
    }

    if (String(admin._id) === targetUserId) {
      throw new BadRequestException('Organization Owner / Admin cannot remove themselves');
    }

    const targetUser = await this.userModel.findById(targetUserId);
    if (!targetUser || (admin.role !== 'SUPER_ADMIN' && targetUser.orgId !== admin.orgId)) {
      throw new NotFoundException('Target user is not a member of your organization');
    }

    // Revert user to PUBLIC_USER and clear org bindings
    targetUser.orgId = null;
    targetUser.role = 'PUBLIC_USER';
    targetUser.groupIds = [];
    await targetUser.save();

    // Also remove from all groups in this org
    await this.groupModel.updateMany(
      { orgId: admin.orgId },
      { $pull: { memberIds: targetUserId, pendingMemberIds: targetUserId } },
    );

    return {
      message: 'Member removed from organization successfully',
      data: { userId: targetUserId },
    };
  }

  // ==================== SLUG-BASED ORG SCOPE ENDPOINTS ====================
  async getOrgBySlug(slug: string, userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    if (!user) throw new UnauthorizedException('User not found');

    const cleanSlug = slug.toLowerCase().trim();
    const org = await this.orgModel.findOne({
      $or: [{ slug: cleanSlug }, { orgId: cleanSlug }],
    }).lean();
    if (!org) throw new NotFoundException(`Organization '${slug}' not found`);

    const isSuper = user.role === 'SUPER_ADMIN' || (user as any).isSuperAdmin;
    const isMember = user.orgId === org.orgId || isSuper;

    const [memberCount, groupCount, quizCount] = await Promise.all([
      this.userModel.countDocuments({ orgId: org.orgId }),
      this.groupModel.countDocuments({ orgId: org.orgId }),
      this.quizModel.countDocuments({ orgId: org.orgId }),
    ]);

    return {
      message: 'Organization retrieved successfully',
      data: {
        organization: org,
        stats: { memberCount, groupCount, quizCount, maxSeats: org.maxSeats || 100 },
        userRole: user.role,
        isMember,
        isOrgAdmin: isSuper || (user.orgId === org.orgId && user.role === 'ORG_ADMIN'),
      },
    };
  }

  async joinOrganization(slugOrId: string, userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId);
    if (!user) throw new NotFoundException('User not found');

    const cleanIdentifier = slugOrId.toLowerCase().trim();
    const org = await this.orgModel.findOne({
      $or: [{ slug: cleanIdentifier }, { orgId: cleanIdentifier }],
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.status !== 'ACTIVE') {
      throw new ForbiddenException('This organization is currently inactive or suspended.');
    }

    if (user.orgId === org.orgId) {
      return {
        message: 'You are already enrolled in this organization',
        data: {
          organization: org,
          user: {
            userId: String(user._id),
            username: user.username,
            email: user.email,
            role: user.role,
            orgId: user.orgId,
            orgSlug: user.orgSlug,
          },
        },
      };
    }

    // 1. Check max seats limitation set by org admin
    const memberCount = await this.userModel.countDocuments({ orgId: org.orgId });
    if (memberCount >= org.maxSeats) {
      throw new ForbiddenException(
        `This organization has reached its maximum seat capacity of ${org.maxSeats} members.`,
      );
    }

    // 2. Check allowed email domain limitation set by org admin
    if (org.allowedEmailDomain) {
      const allowedDomain = org.allowedEmailDomain.toLowerCase().replace(/^@/, '').trim();
      const userEmails = [user.email, ...(user.emails || [])].map((e) => e.toLowerCase().trim());
      const hasValidDomain = userEmails.some((e) => e.endsWith(`@${allowedDomain}`));

      if (!hasValidDomain) {
        throw new ForbiddenException(
          `This organization requires an authorized institutional email ending with "@${allowedDomain}". Your primary account email is "${user.email}". Please link your institutional email in Profile settings to enroll.`,
        );
      }
    }

    // Enroll user into organization
    user.orgId = org.orgId;
    user.orgSlug = org.slug;
    if (!user.role || user.role === 'PUBLIC_USER') {
      user.role = 'ORG_STD';
    }
    user.institution = org.name;
    await user.save();

    return {
      message: `Successfully joined ${org.name}!`,
      data: {
        organization: org,
        user: {
          userId: String(user._id),
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          orgId: user.orgId,
          orgSlug: user.orgSlug,
        },
      },
    };
  }

  async getOrgMembersBySlug(slug: string, userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    if (!user) throw new UnauthorizedException('User not found');

    const org = await this.orgModel.findOne({ slug: slug.toLowerCase().trim() }).lean();
    if (!org) throw new NotFoundException('Organization not found');

    const isSuper = user.role === 'SUPER_ADMIN' || (user as any).isSuperAdmin;
    if (!isSuper && user.orgId !== org.orgId) {
      throw new ForbiddenException('Access denied to organization roster');
    }

    const members = await this.userModel
      .find({ orgId: org.orgId })
      .select('_id username email fullName role xp verified createdAt groupIds profilePicture')
      .sort({ createdAt: -1 })
      .lean();

    return {
      message: 'Organization members retrieved',
      data: {
        members: members.map((m) => ({
          userId: String(m._id),
          username: m.username,
          email: m.email,
          fullName: m.fullName,
          role: m.role,
          xp: m.xp || 0,
          profilePicture: m.profilePicture || '',
          groupIds: m.groupIds || [],
          createdAt: (m as any).createdAt,
        })),
      },
    };
  }

  async getOrgQuizzesBySlug(slug: string, userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    if (!user) throw new UnauthorizedException('User not found');

    const org = await this.orgModel.findOne({ slug: slug.toLowerCase().trim() }).lean();
    if (!org) throw new NotFoundException('Organization not found');

    const isSuper = user.role === 'SUPER_ADMIN' || (user as any).isSuperAdmin;
    if (!isSuper && user.orgId !== org.orgId) {
      throw new ForbiddenException('Access denied to organization quizzes');
    }

    const query: any = { orgId: org.orgId };
    if (user.role === 'ORG_STD' && !isSuper) {
      query.$or = [
        { groupId: { $in: user.groupIds || [] }, status: { $ne: 'DRAFT' } },
        { ownerId: String(user._id), isPractice: true },
      ];
    }

    const quizzes = await this.quizModel
      .find(query)
      .sort({ createdAt: -1 })
      .select('quizId title status accessMode deploymentType orgId groupId isPractice pin scheduledFor liveUntil questions createdAt ownerEmail')
      .lean();

    return {
      message: 'Organization quizzes retrieved',
      data: { quizzes },
    };
  }

  async getOrgGroupsBySlug(slug: string, userPayload: any): Promise<ServiceResponse<any>> {
    const user = await this.userModel.findById(userPayload.userId).lean();
    if (!user) throw new UnauthorizedException('User not found');

    const org = await this.orgModel.findOne({ slug: slug.toLowerCase().trim() }).lean();
    if (!org) throw new NotFoundException('Organization not found');

    const isSuper = user.role === 'SUPER_ADMIN' || (user as any).isSuperAdmin;
    if (!isSuper && user.orgId !== org.orgId) {
      throw new ForbiddenException('Access denied to organization groups');
    }

    let groupQuery: any = { orgId: org.orgId };
    if (user.role === 'ORG_STD' && !isSuper) {
      groupQuery.$or = [
        { memberIds: String(user._id) },
        { isLocked: false, requireApproval: false },
      ];
    }

    const groups = await this.groupModel.find(groupQuery).sort({ createdAt: -1 }).lean();

    const enrichedGroups = await Promise.all(
      groups.map(async (g) => {
        const quizCount = await this.quizModel.countDocuments({ groupId: g.groupId });
        const creator = await this.userModel
          .findById(g.creatorId)
          .select('username fullName profilePicture')
          .lean();

        return {
          ...g,
          memberCount: g.memberIds?.length || 0,
          pendingCount: g.pendingMemberIds?.length || 0,
          quizCount,
          totalMessages: 0,
          creator: creator || { username: 'Instructor' },
          isJoined: g.memberIds?.includes(String(user._id)) || false,
          isPending: g.pendingMemberIds?.includes(String(user._id)) || false,
        };
      }),
    );

    return {
      message: 'Organization groups retrieved',
      data: { groups: enrichedGroups },
    };
  }
}

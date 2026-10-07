import { apiClient } from "./client";
import { API_ROUTES } from "./routes";
import {
  RegisterOrgDto,
  Organization,
  OrgMember,
  SuperAdminStats,
  UserMe,
  Quiz,
} from "./types";

export const orgService = {
  /**
   * Register a new organization and create its primary ORG_ADMIN user
   */
  async registerOrg(data: RegisterOrgDto) {
    return apiClient<{ organization: Organization; user: UserMe; accessToken?: string; refreshToken?: string }>(
      API_ROUTES.org.register,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Get current user's organization profile
   */
  async getCurrentOrg() {
    return apiClient<Organization>(API_ROUTES.org.current, {
      method: "GET",
    });
  },

  /**
   * Get members belonging to current user's organization
   */
  async getOrgMembers() {
    return apiClient<{ members: OrgMember[]; total: number }>(API_ROUTES.org.members, {
      method: "GET",
    });
  },

  /**
   * Update role of an organization member (SUPER_ADMIN, ORG_ADMIN, ORG_PARTNER, ORG_STD)
   */
  async updateMemberRole(userId: string, role: "SUPER_ADMIN" | "ORG_ADMIN" | "ORG_PARTNER" | "ORG_STD" | "ORG_USER") {
    return apiClient<{ member: OrgMember }>(API_ROUTES.org.updateRole(userId), {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  /**
   * Remove member from organization
   */
  async removeMember(userId: string) {
    return apiClient<{ removed: boolean }>(API_ROUTES.org.removeMember(userId), {
      method: "DELETE",
    });
  },

  /**
   * Super Admin: Overview statistics across all tenants
   */
  async getSuperAdminStats() {
    return apiClient<SuperAdminStats>(API_ROUTES.superAdmin.stats, {
      method: "GET",
    });
  },

  /**
   * Super Admin: List all organizations in the platform
   */
  async getSuperAdminOrgs() {
    return apiClient<{ organizations: Organization[]; total: number }>(
      API_ROUTES.superAdmin.orgs,
      {
        method: "GET",
      }
    );
  },

  /**
   * Super Admin: Drilldown into specific organization
   */
  async getSuperAdminOrgDetails(orgId: string) {
    return apiClient<{
      organization: Organization;
      members: OrgMember[];
      groups?: any[];
      quizzes: Quiz[];
      stats?: { totalMembers?: number; totalQuizzes?: number; totalAttempts?: number; totalGroups?: number };
    }>(API_ROUTES.superAdmin.orgDetails(orgId), {
      method: "GET",
    });
  },

  /**
   * Super Admin: List all quizzes created across all organizations
   */
  async getSuperAdminQuizzes() {
    return apiClient<{ quizzes: Quiz[]; total: number }>(API_ROUTES.superAdmin.quizzes, {
      method: "GET",
    });
  },

  /**
   * Get organization profile and stats by slug
   */
  async getOrgBySlug(slug: string) {
    return apiClient<{
      organization: Organization;
      stats: { memberCount: number; groupCount: number; quizCount: number; maxSeats: number };
      userRole: string;
      isMember: boolean;
      isOrgAdmin: boolean;
    }>(API_ROUTES.org.bySlug(slug), {
      method: "GET",
    });
  },

  /**
   * Join an organization as a student/learner (ORG_STD)
   */
  async joinOrg(slug: string) {
    return apiClient<{ organization: Organization; user: UserMe }>(API_ROUTES.org.join(slug), {
      method: "POST",
    });
  },

  /**
   * Get organization members by slug
   */
  async getOrgMembersBySlug(slug: string) {
    return apiClient<{ members: OrgMember[] }>(API_ROUTES.org.membersBySlug(slug), {
      method: "GET",
    });
  },

  /**
   * Get organization quizzes by slug
   */
  async getOrgQuizzesBySlug(slug: string) {
    return apiClient<{ quizzes: Quiz[] }>(API_ROUTES.org.quizzesBySlug(slug), {
      method: "GET",
    });
  },

  /**
   * Get organization groups/cohorts by slug
   */
  async getOrgGroupsBySlug(slug: string) {
    return apiClient<{ groups: any[] }>(API_ROUTES.org.groupsBySlug(slug), {
      method: "GET",
    });
  },
};

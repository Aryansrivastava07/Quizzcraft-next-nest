import { apiClient } from "./client";
import { API_ROUTES } from "./routes";
import {
  Group,
  CreateGroupDto,
  GroupMessage,
  SendGroupMessageDto,
  GroupGradebookResponse,
  Quiz,
  OrgMember,
} from "./types";

export const groupService = {
  /**
   * Create a new group (Partner or Admin)
   */
  async createGroup(data: CreateGroupDto) {
    return apiClient<{ group: Group }>(API_ROUTES.group.create, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * List groups the current user belongs to or can view
   */
  async getUserGroups() {
    return apiClient<{ groups: Group[] }>(API_ROUTES.group.list, {
      method: "GET",
    });
  },

  /**
   * Discover explore public groups across the community
   */
  async getPublicGroups() {
    return apiClient<{ groups: Group[] }>(API_ROUTES.group.explorePublic, {
      method: "GET",
    });
  },

  /**
   * 1-click join a group directly by groupId
   */
  async joinGroupById(groupId: string) {
    return apiClient<{ groupId: string; status: "ENROLLED" | "PENDING_APPROVAL" | "ALREADY_MEMBER" }>(
      API_ROUTES.group.joinById(groupId),
      {
        method: "POST",
      }
    );
  },

  /**
   * Get single group details including members info
   */
  async getGroupById(groupId: string) {
    return apiClient<{
      group: Group;
      members: OrgMember[];
      pendingMembers: OrgMember[];
      isCreator: boolean;
      isMember: boolean;
    }>(API_ROUTES.group.get(groupId), {
      method: "GET",
    });
  },

  /**
   * Join a group using a 6-character code (e.g. QC-A8B9)
   */
  async joinGroupByCode(code: string) {
    return apiClient<{ group?: Group; groupId?: string; status: "JOINED" | "PENDING_APPROVAL" | "ENROLLED" | "ALREADY_MEMBER" }>(
      API_ROUTES.group.join,
      {
        method: "POST",
        body: JSON.stringify({ code }),
      }
    );
  },

  /**
   * Alias for joinGroupByCode
   */
  async joinGroup(code: string) {
    return this.joinGroupByCode(code);
  },

  /**
   * Approve a pending member request
   */
  async approvePendingMember(groupId: string, userId: string) {
    return apiClient<{ approved: boolean }>(API_ROUTES.group.approve(groupId, userId), {
      method: "POST",
    });
  },

  /**
   * Regenerate group 6-character invite code
   */
  async regenerateGroupCode(groupId: string) {
    return apiClient<{ code: string }>(API_ROUTES.group.regenerateCode(groupId), {
      method: "POST",
    });
  },

  /**
   * Update group locks / approval settings
   */
  async updateSettings(
    groupId: string,
    data: { isLocked?: boolean; requireApproval?: boolean; name?: string; description?: string }
  ) {
    return apiClient<Group>(API_ROUTES.group.updateSettings(groupId), {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * Get quizzes assigned to this group
   */
  async getGroupQuizzes(groupId: string) {
    return apiClient<{ quizzes: Quiz[] }>(API_ROUTES.group.quizzes(groupId), {
      method: "GET",
    });
  },

  /**
   * Get gradebook matrix for this group
   */
  async getGroupGradebook(groupId: string) {
    return apiClient<GroupGradebookResponse>(API_ROUTES.group.gradebook(groupId), {
      method: "GET",
    });
  },

  /**
   * Get group discussion room messages
   */
  async getGroupMessages(groupId: string) {
    return apiClient<{ messages: GroupMessage[] }>(API_ROUTES.group.messages(groupId), {
      method: "GET",
    });
  },

  /**
   * Post a message to group discussion room (with optional question context)
   */
  async postGroupMessage(groupId: string, data: SendGroupMessageDto) {
    return apiClient<GroupMessage>(API_ROUTES.group.sendMessage(groupId), {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Pin or unpin a message (Partner / Admin)
   */
  async pinGroupMessage(groupId: string, messageId: string) {
    return apiClient<{ message: GroupMessage }>(
      API_ROUTES.group.pinMessage(groupId, messageId),
      {
        method: "PATCH",
      }
    );
  },

  /**
   * Delete a message (Sender or Group Admin)
   */
  async deleteGroupMessage(groupId: string, messageId: string) {
    return apiClient<{ deleted: boolean }>(
      API_ROUTES.group.deleteMessage(groupId, messageId),
      {
        method: "DELETE",
      }
    );
  },
};

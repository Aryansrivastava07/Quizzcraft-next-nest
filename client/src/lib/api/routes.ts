/**
 * Backend API Route Definitions
 * Mapped from NestJS Controllers in D:\Aryan\coding\projects\quizz-craft\backend
 */

// When using Next.js / Vercel proxy rewrites, use relative URL ("") so the browser treats API requests as same-domain.
// This allows cookies (accessToken, refreshToken, RESET_PASS_TOKEN) to be stored as 1st-party cookies and automatically attached by the browser.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export const API_ROUTES = {
  // ==========================================
  // AUTH ROUTES (Prefix: /auth)
  // File: src/auth/auth.controller.ts
  // ==========================================
  auth: {
    base: `${API_BASE_URL}/auth`,
    me: `${API_BASE_URL}/auth/me`,                                  // GET  (JwtAuthGuard)
    register: `${API_BASE_URL}/auth/register`,                      // POST
    login: `${API_BASE_URL}/auth/login`,                            // POST (sets accessToken & refreshToken cookies)
    logout: `${API_BASE_URL}/auth/logout`,                          // POST (JwtAuthGuard, clears cookies)
    refresh: `${API_BASE_URL}/auth/refresh`,                        // POST (rotates tokens via cookies)
    resendRegisterOTP: `${API_BASE_URL}/auth/resend-register-otp`,  // POST
    verifyRegisterOTP: `${API_BASE_URL}/auth/verify-register-otp`,  // POST (sets cookies on success)
    sendPasswordResetMail: `${API_BASE_URL}/auth/send-password-reset-mail`, // POST
    resendPasswordResetOTP: `${API_BASE_URL}/auth/resend-password-reset-otp`, // POST
    verifyPasswordResetOTP: `${API_BASE_URL}/auth/verify-password-reset-otp`, // POST (sets RESET_PASS_TOKEN cookie)
    resetPassword: `${API_BASE_URL}/auth/reset-password`,          // POST (ResetPassGuard)
    checkUsername: (username: string) =>
      `${API_BASE_URL}/auth/check-username?username=${encodeURIComponent(username)}`, // GET
  },

  // ==========================================
  // QUIZ ROUTES (Prefix: /api/quiz)
  // File: src/quiz/quiz.controller.ts
  // Note: All routes protected by JwtAuthGuard
  // ==========================================
  quiz: {
    base: `${API_BASE_URL}/api/quiz`,
    // POST multipart/form-data: prompt, images, videos, pdfs
    generate: `${API_BASE_URL}/api/quiz/generate`,
    // GET: Fetch quiz details and questions by quizId
    get: (quizId: string) => `${API_BASE_URL}/api/quiz/${quizId}`,
    // GET: Fetch quiz details and questions by 6-digit PIN
    getByPin: (pin: string) => `${API_BASE_URL}/api/quiz/pin/${encodeURIComponent(pin)}`,
    // PUT: Update quiz details and questions by quizId
    update: (quizId: string) => `${API_BASE_URL}/api/quiz/${quizId}`,
    // PUT: Edit a single question inside a quiz
    editQuestion: (quizId: string, questionId: string) =>
      `${API_BASE_URL}/api/quiz/${quizId}/question/${questionId}`,
    // POST: Add a new question to a quiz
    addQuestion: (quizId: string) => `${API_BASE_URL}/api/quiz/${quizId}/question`,
    // DELETE: Remove a question from a quiz
    deleteQuestion: (quizId: string, questionId: string) =>
      `${API_BASE_URL}/api/quiz/${quizId}/question/${questionId}`,
    // GET: Start or resume an active session for a quiz
    attempt: (quizId: string) => `${API_BASE_URL}/api/quiz/attempt/${quizId}`,
    // POST: Update answer for questionId in active session
    updateAnswer: (sessionId: string) => `${API_BASE_URL}/api/quiz/attempt/answer/${sessionId}`,
    // POST: Finalize session responses & submit
    submitAttempt: (sessionId: string) => `${API_BASE_URL}/api/quiz/attempt/submit/${sessionId}`,
    // GET: Calculate final score for submitted session
    getScore: (sessionId: string) => `${API_BASE_URL}/api/quiz/score/${sessionId}`,
    // POST: Deploy quiz with protocol, access mode, and duration
    deploy: (quizId: string) => `${API_BASE_URL}/api/quiz/${quizId}/deploy`,
    // GET: Admin telemetry, attendees, average score, and live leaderboard
    admin: (quizId: string) => `${API_BASE_URL}/api/quiz/${quizId}/admin`,
    // POST: Join waitlist for scheduled quiz
    waitlist: (quizId: string) => `${API_BASE_URL}/api/quiz/${quizId}/waitlist`,
    // POST: Conclude/close live quiz session
    close: (quizId: string) => `${API_BASE_URL}/api/quiz/${quizId}/close`,
    // GET: Explore deployed public quizzes
    public: (params?: string) => `${API_BASE_URL}/api/quiz/public${params ? `?${params}` : ''}`,
    // GET: Quiz review, analytics & leaderboard (no questions shown)
    review: (quizId: string) => `${API_BASE_URL}/api/quiz/${quizId}/review`,
  },

  // ==========================================
  // PROFILE ROUTES (Prefix: /api/profile)
  // File: src/profile/profile.controller.ts
  // Note: All routes protected by JwtAuthGuard
  // ==========================================
  profile: {
    base: `${API_BASE_URL}/api/profile`,
    // GET ?email=...: Get profile info
    get: (email: string) => `${API_BASE_URL}/api/profile?email=${encodeURIComponent(email)}`,
    // POST: Update username { email, userName }
    update: `${API_BASE_URL}/api/profile`,
    // GET: Get quizzes for authenticated user (from JWT email)
    quizzes: `${API_BASE_URL}/api/profile/quizzes`,
    // GET: Get past quiz attempts for authenticated user (from JWT email)
    history: `${API_BASE_URL}/api/profile/history`,
    // PUT: Update user settings & preferences
    settings: `${API_BASE_URL}/api/profile/settings`,
    // POST: Submit a support ticket
    ticket: `${API_BASE_URL}/api/profile/ticket`,
    // GET: Check username availability
    checkUsername: (username: string) =>
      `${API_BASE_URL}/api/profile/check-username?username=${encodeURIComponent(username)}`,
    // POST: Link additional / organization email
    linkEmail: `${API_BASE_URL}/api/profile/link-email`,
    // POST: Unlink email
    unlinkEmail: `${API_BASE_URL}/api/profile/unlink-email`,
  },

  // ==========================================
  // ORGANIZATION ROUTES
  // File: src/organization/organization.controller.ts
  // ==========================================
  org: {
    register: `${API_BASE_URL}/api/org/register`,
    current: `${API_BASE_URL}/api/org/current`,
    members: `${API_BASE_URL}/api/org/members`,
    updateRole: (userId: string) => `${API_BASE_URL}/api/org/members/${encodeURIComponent(userId)}/role`,
    removeMember: (userId: string) => `${API_BASE_URL}/api/org/members/${encodeURIComponent(userId)}`,
    bySlug: (slug: string) => `${API_BASE_URL}/api/org/by-slug/${encodeURIComponent(slug)}`,
    join: (slug: string) => `${API_BASE_URL}/api/org/join/${encodeURIComponent(slug)}`,
    membersBySlug: (slug: string) => `${API_BASE_URL}/api/org/by-slug/${encodeURIComponent(slug)}/members`,
    quizzesBySlug: (slug: string) => `${API_BASE_URL}/api/org/by-slug/${encodeURIComponent(slug)}/quizzes`,
    groupsBySlug: (slug: string) => `${API_BASE_URL}/api/org/by-slug/${encodeURIComponent(slug)}/groups`,
  },

  // ==========================================
  // SUPER ADMIN ROUTES
  // File: src/organization/organization.controller.ts
  // ==========================================
  superAdmin: {
    stats: `${API_BASE_URL}/api/super-admin/stats`,
    orgs: `${API_BASE_URL}/api/super-admin/orgs`,
    orgDetails: (orgId: string) => `${API_BASE_URL}/api/super-admin/orgs/${encodeURIComponent(orgId)}`,
    quizzes: `${API_BASE_URL}/api/super-admin/quizzes`,
  },

  // ==========================================
  // GROUP ROUTES
  // File: src/group/group.controller.ts
  // ==========================================
  group: {
    base: `${API_BASE_URL}/api/groups`,
    create: `${API_BASE_URL}/api/groups`,
    list: `${API_BASE_URL}/api/groups`,
    explorePublic: `${API_BASE_URL}/api/groups/explore/public`,
    get: (groupId: string) => `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}`,
    join: `${API_BASE_URL}/api/groups/join`,
    joinById: (groupId: string) => `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/join`,
    approve: (groupId: string, userId: string) =>
      `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/approve/${encodeURIComponent(userId)}`,
    regenerateCode: (groupId: string) =>
      `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/regenerate-code`,
    updateSettings: (groupId: string) =>
      `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/settings`,
    quizzes: (groupId: string) =>
      `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/quizzes`,
    gradebook: (groupId: string) =>
      `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/gradebook`,
    messages: (groupId: string) =>
      `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/messages`,
    sendMessage: (groupId: string) =>
      `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/messages`,
    pinMessage: (groupId: string, messageId: string) =>
      `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}/pin`,
    deleteMessage: (groupId: string, messageId: string) =>
      `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}`,
  },

  // ==========================================
  // NOTIFICATIONS ROUTES
  // File: src/notification/notification.controller.ts
  // ==========================================
  notifications: {
    list: `${API_BASE_URL}/api/notifications`,
    read: (id: string) => `${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}/read`,
    readAll: `${API_BASE_URL}/api/notifications/read-all`,
  },
} as const;

import { MailConfig } from "../mail.interface";

export interface ScheduledQuizAlertMailData {
  ownerEmail: string;
  quizTitle: string;
  quizId: string;
  pin: string;
  scheduledFor: Date | string;
  waitingCadetsCount: number;
}

export const scheduledQuizAlertMail: MailConfig<ScheduledQuizAlertMailData> = {
  from: 'QuizzCraft Telemetry <alerts@quizzcraft.app>',
  subject: 'T-Minus 5 Minutes: Your Scheduled Quiz is Preparing to Launch',
  template: ({ quizTitle, quizId, pin, scheduledFor, waitingCadetsCount }) => {
    const formattedDate = new Date(scheduledFor).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const adminUrl = process.env.CLIENT_URL
      ? `${process.env.CLIENT_URL}/quiz/admin?quizId=${encodeURIComponent(quizId)}`
      : `http://localhost:3000/quiz/admin?quizId=${encodeURIComponent(quizId)}`;

    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0b0f19; color: #e2e8f0; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
        <h2 style="color: #2fe6c7; margin: 0; font-size: 20px;">QuizzCraft Mission Control</h2>
      </div>
      <div style="padding: 12px 16px; background-color: rgba(47, 230, 199, 0.1); border: 1px solid rgba(47, 230, 199, 0.3); border-radius: 8px; margin-bottom: 18px;">
        <span style="color: #2fe6c7; font-weight: bold; font-size: 14px;">⚡ T-MINUS 5 MINUTES TO ARENA LAUNCH</span>
      </div>
      <p style="font-size: 14px; color: #94a3b8; margin: 0 0 16px 0;">
        Commander, your scheduled quiz <strong>"${quizTitle}"</strong> is scheduled to go LIVE at <strong>${formattedDate}</strong>.
      </p>
      
      <div style="background-color: #131b2e; padding: 18px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #1e293b;">
        <table style="width: 100%; font-size: 13px; color: #cbd5e1; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; width: 140px;"><strong>Room PIN:</strong></td>
            <td style="padding: 6px 0; font-family: monospace; font-size: 16px; font-weight: bold; color: #38bdf8;">${pin || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>Cadets in Waitlist:</strong></td>
            <td style="padding: 6px 0; font-weight: bold; color: #fbbf24;">${waitingCadetsCount} Cadets Waiting</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>Arena Status:</strong></td>
            <td style="padding: 6px 0; color: #34d399;">Auto-Transitioning to LIVE</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${adminUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #2fe6c7 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: bold; font-size: 14px;">
          Access Quiz Admin Control Center →
        </a>
      </div>

      <p style="font-size: 12px; color: #64748b; margin: 0; line-height: 1.5;">
        As soon as the countdown reaches zero, all waiting cadets will be automatically routed to the quiz arena.
      </p>
    </div>
    `;
  },
};

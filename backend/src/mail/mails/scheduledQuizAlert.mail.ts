import { MailConfig } from "../mail.interface";
import { renderBaseEmailLayout } from "./base.layout";

export interface ScheduledQuizAlertMailData {
  ownerEmail: string;
  quizTitle: string;
  quizId: string;
  pin: string;
  scheduledFor: Date | string;
  waitingCadetsCount: number;
}

export const scheduledQuizAlertMail: MailConfig<ScheduledQuizAlertMailData> = {
  from: process.env.RESEND_FROM_EMAIL || 'QuizzCraft Telemetry <alerts@quizzcraft.app>',
  subject: 'T-Minus 5 Minutes: Your Scheduled Quiz is Preparing to Launch',
  template: ({ quizTitle, quizId, pin, scheduledFor, waitingCadetsCount }) => {
    const formattedTime = new Date(scheduledFor).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const baseUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const adminUrl = `${baseUrl}/quiz/admin?quizId=${encodeURIComponent(quizId)}`;

    const contentHtml = `
      <!-- Emergency Countdown Banner -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background: linear-gradient(90deg, rgba(124, 58, 237, 0.2) 0%, rgba(47, 230, 199, 0.2) 100%); border: 1px solid rgba(47, 230, 199, 0.4); border-radius: 12px;">
        <tr>
          <td style="padding: 14px 20px; text-align: center;">
            <span style="font-size: 13px; font-weight: 800; color: #2fe6c7; letter-spacing: 1.5px; text-transform: uppercase;">
              ⚡ T-MINUS 5 MINUTES &bull; ARENA LAUNCH SEQUENCE
            </span>
          </td>
        </tr>
      </table>

      <!-- Heading -->
      <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
        Battle Arena Preparing for Launch! 🚀
      </h1>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
        Commander, your scheduled battle <strong style="color: #f1f5f9;">"${quizTitle}"</strong> is scheduled to go LIVE at <strong style="color: #2fe6c7;">${formattedTime}</strong>.
      </p>

      <!-- Mission Telemetry Card -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 28px 0; background-color: #111a2e; border: 1px solid #1e293b; border-radius: 14px; overflow: hidden;">
        <tr>
          <td style="padding: 22px 24px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; border-collapse: collapse;">
              
              <!-- Room PIN Highlight -->
              <tr>
                <td style="padding: 10px 0; color: #94a3b8; width: 140px; font-weight: 500;">Room PIN:</td>
                <td style="padding: 10px 0;">
                  <span style="font-family: 'JetBrains Mono', Consolas, monospace; font-size: 22px; font-weight: 800; color: #38bdf8; letter-spacing: 2px;">
                    ${pin || 'N/A'}
                  </span>
                </td>
              </tr>

              <!-- Cadets Queued -->
              <tr>
                <td style="padding: 8px 0; color: #94a3b8; font-weight: 500;">Waitlist Status:</td>
                <td style="padding: 8px 0;">
                  <span style="display: inline-block; padding: 2px 10px; font-size: 12px; font-weight: 700; color: #fbbf24; background-color: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 9999px;">
                    👥 ${waitingCadetsCount} Cadets in Lobby
                  </span>
                </td>
              </tr>

              <!-- Auto-Transition -->
              <tr>
                <td style="padding: 8px 0; color: #94a3b8; font-weight: 500;">Arena Engine:</td>
                <td style="padding: 8px 0;">
                  <span style="display: inline-block; padding: 2px 10px; font-size: 12px; font-weight: 700; color: #34d399; background-color: rgba(52, 211, 153, 0.12); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: 9999px;">
                    🟢 Auto-Transition to LIVE
                  </span>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>

      <!-- Prominent Call To Action Button -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
        <tr>
          <td align="center">
            <a href="${adminUrl}" target="_blank" style="display: inline-block; padding: 15px 36px; background: linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #06b6d4 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5); text-align: center;">
              Enter Mission Control Room &rarr;
            </a>
          </td>
        </tr>
      </table>

      <!-- Commander Checklist -->
      <div style="background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: 700; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">
          Commander Checklist
        </div>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #64748b;">
          <li>All waiting cadets will automatically transition to Question 1 at launch.</li>
          <li>Keep the Admin console open to manage timers and observe real-time leaderboards.</li>
        </ul>
      </div>
    `;

    return renderBaseEmailLayout({
      previewText: `T-Minus 5 Minutes: "${quizTitle}" launches soon [Room PIN: ${pin}]`,
      badgeText: 'MISSION TELEMETRY',
      badgeColor: '#2FE6C7',
      contentHtml,
    });
  },
};

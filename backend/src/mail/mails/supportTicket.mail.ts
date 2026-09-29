import { MailConfig } from "../mail.interface";
import { renderBaseEmailLayout } from "./base.layout";

export interface SupportTicketMailData {
  ticketId: string;
  name: string;
  email: string;
  category: string;
  urgency: string;
  subject: string;
  message: string;
}

export const supportTicketMail: MailConfig<SupportTicketMailData> = {
  from: process.env.RESEND_FROM_EMAIL || 'QuizzCraft Support <support@quizzcraft.app>',
  subject: 'Support Ticket Received',
  template: ({ ticketId, name, email, category, urgency, subject, message }) => {
    // Dynamic color for urgency level
    const urgencyNormalized = (urgency || '').toLowerCase();
    let urgencyBg = 'rgba(56, 189, 248, 0.12)';
    let urgencyColor = '#38bdf8';
    let urgencyBorder = 'rgba(56, 189, 248, 0.3)';

    if (urgencyNormalized.includes('critical') || urgencyNormalized.includes('high')) {
      urgencyBg = 'rgba(239, 68, 68, 0.12)';
      urgencyColor = '#f87171';
      urgencyBorder = 'rgba(239, 68, 68, 0.3)';
    } else if (urgencyNormalized.includes('medium')) {
      urgencyBg = 'rgba(245, 158, 11, 0.12)';
      urgencyColor = '#fbbf24';
      urgencyBorder = 'rgba(245, 158, 11, 0.3)';
    }

    const contentHtml = `
      <!-- Heading & Greeting -->
      <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
        Support Ticket Received 🎫
      </h1>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
        Hello <strong style="color: #f1f5f9;">${name || 'Cadet'}</strong>, your inquiry has been registered in our flight desk system. A technical support specialist is reviewing your case.
      </p>

      <!-- Ticket Metadata Card -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px 0; background-color: #111a2e; border: 1px solid #1e293b; border-radius: 14px; overflow: hidden;">
        <tr>
          <td style="padding: 20px 24px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; border-collapse: collapse;">
              
              <!-- Ticket ID -->
              <tr>
                <td style="padding: 8px 0; color: #94a3b8; width: 110px; font-weight: 500;">Ticket ID:</td>
                <td style="padding: 8px 0;">
                  <span style="font-family: 'JetBrains Mono', Consolas, monospace; font-size: 13px; font-weight: 700; color: #38bdf8; background-color: rgba(56, 189, 248, 0.1); padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.25);">
                    ${ticketId}
                  </span>
                </td>
              </tr>

              <!-- Category -->
              <tr>
                <td style="padding: 8px 0; color: #94a3b8; font-weight: 500;">Category:</td>
                <td style="padding: 8px 0; color: #f1f5f9; font-weight: 600;">
                  ${category || 'General Support'}
                </td>
              </tr>

              <!-- Urgency -->
              <tr>
                <td style="padding: 8px 0; color: #94a3b8; font-weight: 500;">Priority:</td>
                <td style="padding: 8px 0;">
                  <span style="display: inline-block; padding: 2px 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: ${urgencyColor}; background-color: ${urgencyBg}; border: 1px solid ${urgencyBorder}; border-radius: 9999px;">
                    ${urgency || 'Normal'}
                  </span>
                </td>
              </tr>

              <!-- Subject -->
              <tr>
                <td style="padding: 8px 0; color: #94a3b8; font-weight: 500;">Subject:</td>
                <td style="padding: 8px 0; color: #ffffff; font-weight: 700;">
                  ${subject}
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>

      <!-- Submitted Message Quote Block -->
      <div style="margin: 0 0 24px 0; background-color: #0b0f19; border: 1px solid #1e293b; border-left: 4px solid #38bdf8; border-radius: 0 12px 12px 0; padding: 18px 20px;">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">
          YOUR SUBMITTED INQUIRY
        </div>
        <div style="font-size: 14px; line-height: 1.6; color: #cbd5e1; white-space: pre-wrap; word-break: break-word;">
          ${message}
        </div>
      </div>

      <!-- Turnaround Notice -->
      <div style="background-color: rgba(47, 230, 199, 0.06); border: 1px solid rgba(47, 230, 199, 0.2); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="24" valign="top" style="padding-top: 1px;">
              <span style="font-size: 16px;">⏱️</span>
            </td>
            <td style="padding-left: 10px; font-size: 13px; line-height: 1.5; color: #94a3b8;">
              <strong style="color: #2fe6c7;">Estimated Turnaround:</strong> Our technical team typically responds within 24 hours. Updates will be dispatched to <strong style="color: #f1f5f9;">${email}</strong>.
            </td>
          </tr>
        </table>
      </div>
    `;

    return renderBaseEmailLayout({
      previewText: `Support Ticket [${ticketId}] logged: ${subject}`,
      badgeText: 'TICKET LOGGED',
      badgeColor: '#38BDF8',
      contentHtml,
    });
  },
};

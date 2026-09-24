import { MailConfig } from "../mail.interface";

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
  from: 'QuizzCraft Support <support@quizzcraft.app>',
  subject: 'Support Ticket Received',
  template: ({ ticketId, name, email, category, urgency, subject, message }) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0b0f19; color: #e2e8f0; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
        <h2 style="color: #818cf8; margin: 0; font-size: 20px;">QuizzCraft Support</h2>
      </div>
      <p style="font-size: 14px; color: #94a3b8; margin: 0 0 16px 0;">
        Hello ${name || 'Pilot'}, your support dispatch has been logged in our system.
      </p>
      <div style="background-color: #131b2e; padding: 18px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #1e293b;">
        <table style="width: 100%; font-size: 13px; color: #cbd5e1; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; width: 100px;"><strong>Ticket ID:</strong></td>
            <td style="padding: 6px 0; font-family: monospace; color: #38bdf8;">${ticketId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>Category:</strong></td>
            <td style="padding: 6px 0;">${category}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>Urgency:</strong></td>
            <td style="padding: 6px 0;"><span style="color: #fbbf24;">${urgency}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94a3b8;"><strong>Subject:</strong></td>
            <td style="padding: 6px 0; font-weight: bold; color: #f8fafc;">${subject}</td>
          </tr>
        </table>
        <hr style="border: none; border-top: 1px solid #1e293b; margin: 14px 0;" />
        <div style="font-size: 13px; color: #e2e8f0; line-height: 1.6; white-space: pre-wrap;">${message}</div>
      </div>
      <p style="font-size: 12px; color: #64748b; margin: 0; line-height: 1.5;">
        A QuizzCraft technical specialist is reviewing your inquiry. We will contact you at <strong>${email}</strong> as soon as an update is available.
      </p>
    </div>
  `,
};

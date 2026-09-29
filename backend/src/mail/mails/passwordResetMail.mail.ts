import { MailConfig } from "../mail.interface";
import { renderBaseEmailLayout } from "./base.layout";

export interface PasswordResetMailData {
  OTP: string;
  email?: string;
}

export const passwordResetMail: MailConfig<PasswordResetMailData> = {
  from: process.env.RESEND_FROM_EMAIL || 'QuizzCraft <noreply@quizzcraft.app>',
  subject: 'Reset your QuizzCraft password',
  template: ({ OTP, email }) => {
    const contentHtml = `
      <!-- Heading & Context -->
      <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
        Password Reset Request 🔐
      </h1>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
        We received a request to reset the password for your QuizzCraft account${
          email ? ` (<span style="color: #e2e8f0; font-weight: 600;">${email}</span>)` : ''
        }. Use the 6-digit authorization code below to establish new credentials:
      </p>

      <!-- OTP Card Box -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 28px 0; background: linear-gradient(180deg, #1c1936 0%, #111429 100%); border: 1px solid rgba(167, 139, 250, 0.4); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
        <tr>
          <td align="center" style="padding: 28px 20px 24px;">
            <div style="font-size: 11px; font-weight: 700; color: #a78bfa; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">
              RESET AUTHORIZATION CODE
            </div>
            
            <!-- Big Monospace Digits -->
            <div class="otp-code" style="font-family: 'JetBrains Mono', 'Fira Code', SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #ffffff; text-shadow: 0 0 20px rgba(167, 139, 250, 0.45); padding: 6px 0 14px 10px;">
              ${OTP}
            </div>

            <!-- Expiry Tag -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 4px 14px; background-color: rgba(167, 139, 250, 0.12); border: 1px solid rgba(167, 139, 250, 0.3); border-radius: 9999px;">
                  <span style="font-size: 12px; font-weight: 600; color: #c4b5fd;">
                    ⏱️ Expires in 10 minutes &bull; Single-use only
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Security Warning Box -->
      <div style="background-color: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.28); border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="28" valign="top" style="padding-top: 2px;">
              <span style="font-size: 18px;">⚠️</span>
            </td>
            <td style="padding-left: 8px;">
              <div style="font-size: 13px; font-weight: 700; color: #fbbf24; margin-bottom: 4px;">
                Didn't request this change?
              </div>
              <div style="font-size: 13px; line-height: 1.5; color: #cbd5e1;">
                If you did not request a password reset, please ignore this email or review your account security immediately. Your current password remains secure unless this code is entered.
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Outro Help -->
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">
        For your safety, QuizzCraft representatives will never request this verification code or your password.
      </p>
    `;

    return renderBaseEmailLayout({
      previewText: `Your QuizzCraft password reset code is ${OTP}. Expires in 10 minutes.`,
      badgeText: 'SECURITY ACCESS',
      badgeColor: '#A78BFA',
      contentHtml,
    });
  },
};
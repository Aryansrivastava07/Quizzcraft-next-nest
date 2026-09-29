import { MailConfig } from "../mail.interface";
import { renderBaseEmailLayout } from "./base.layout";

export interface VerificationMailData {
  OTP: string;
  email?: string;
}

export const verificationMail: MailConfig<VerificationMailData> = {
  from: process.env.RESEND_FROM_EMAIL || 'QuizzCraft <noreply@quizzcraft.app>',
  subject: 'Verify your QuizzCraft account',
  template: ({ OTP, email }) => {
    const contentHtml = `
      <!-- Greeting & Intro -->
      <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
        Welcome to QuizzCraft! 🚀
      </h1>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
        You're one step away from entering the live knowledge arenas. To verify your email address${
          email ? ` (<span style="color: #e2e8f0; font-weight: 600;">${email}</span>)` : ''
        } and activate your cadet profile, enter this one-time security code:
      </p>

      <!-- OTP Card Box -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 28px 0; background: linear-gradient(180deg, #131d33 0%, #0d1526 100%); border: 1px solid rgba(47, 230, 199, 0.35); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
        <tr>
          <td align="center" style="padding: 28px 20px 24px;">
            <div style="font-size: 11px; font-weight: 700; color: #2fe6c7; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">
              ONE-TIME VERIFICATION CODE
            </div>
            
            <!-- Big Monospace Digits -->
            <div class="otp-code" style="font-family: 'JetBrains Mono', 'Fira Code', SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #ffffff; text-shadow: 0 0 20px rgba(47, 230, 199, 0.4); padding: 6px 0 14px 10px;">
              ${OTP}
            </div>

            <!-- Expiry Tag -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 4px 14px; background-color: rgba(47, 230, 199, 0.1); border: 1px solid rgba(47, 230, 199, 0.25); border-radius: 9999px;">
                  <span style="font-size: 12px; font-weight: 600; color: #2fe6c7;">
                    ⏱️ Valid for 10 minutes &bull; Single-use only
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Next Steps & Security Advice -->
      <div style="background-color: #111a2e; border: 1px solid #1e293b; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="28" valign="top" style="padding-top: 2px;">
              <span style="font-size: 18px;">🛡️</span>
            </td>
            <td style="padding-left: 8px;">
              <div style="font-size: 13px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px;">
                Security Best Practice
              </div>
              <div style="font-size: 13px; line-height: 1.5; color: #94a3b8;">
                Never share this verification code with anyone. QuizzCraft engineers will never ask for your code or credentials.
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Outro Help -->
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">
        Didn't create an account with QuizzCraft? You can safely ignore this email &mdash; no account will be activated without this verification step.
      </p>
    `;

    return renderBaseEmailLayout({
      previewText: `Your QuizzCraft verification code is ${OTP}. Enter it to complete your account setup.`,
      badgeText: 'CADET REGISTRATION',
      badgeColor: '#2FE6C7',
      contentHtml,
    });
  },
};